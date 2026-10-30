"""Small JSON record store with identical local and AWS contracts."""
import json
import sqlite3
from pathlib import Path


class SQLiteStore:
    def __init__(self, path):
        self.path = path
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        with self.connect() as db:
            db.execute('CREATE TABLE IF NOT EXISTS records (kind TEXT, id TEXT, owner TEXT, data TEXT NOT NULL, PRIMARY KEY(kind, id))')

    def connect(self):
        return sqlite3.connect(self.path, timeout=10)

    def put(self, kind, record):
        with self.connect() as db:
            db.execute('INSERT OR REPLACE INTO records VALUES (?, ?, ?, ?)',
                       (kind, record['id'], record.get('sessionId', ''), json.dumps(record, ensure_ascii=False)))
        return record

    def get(self, kind, identifier):
        with self.connect() as db:
            row = db.execute('SELECT data FROM records WHERE kind=? AND id=?', (kind, identifier)).fetchone()
        return json.loads(row[0]) if row else None

    def list(self, kind, limit=100, session_id=None):
        sql = 'SELECT data FROM records WHERE kind=?'
        args = [kind]
        if session_id is not None:
            sql += ' AND owner=?'
            args.append(session_id)
        sql += ' ORDER BY rowid DESC LIMIT ?'
        with self.connect() as db:
            return [json.loads(row[0]) for row in db.execute(sql, args + [limit]).fetchall()]

    def list_recent_items(self, limit=100):
        # Items are immutable; rowid reflects insertion order, including legacy items.
        return self.list('item', limit)


class DynamoStore:
    def __init__(self, table):
        self.table = table

    def put(self, kind, record):
        self.table.put_item(Item={'pk': kind + '#' + record['id'], 'kind': kind,
                                  'owner': record.get('sessionId', ''),
                                  'data': json.dumps(record, ensure_ascii=False)})
        return record

    def get(self, kind, identifier):
        item = self.table.get_item(Key={'pk': kind + '#' + identifier}, ConsistentRead=True).get('Item')
        return json.loads(item['data']) if item else None

    def list_recent_items(self, limit=100, scan_budget=10000):
        # Scan order is arbitrary. Examine all pages before selecting newest
        # items, or fail explicitly rather than return a misleading subset.
        params = {'FilterExpression': '#kind = :kind', 'ExpressionAttributeNames': {'#kind': 'kind'},
                  'ExpressionAttributeValues': {':kind': 'item'}, 'ConsistentRead': True}
        records = []
        scanned = 0
        while True:
            params['Limit'] = min(200, scan_budget - scanned)
            page = self.table.scan(**params)
            scanned += page['ScannedCount']
            records.extend(json.loads(item['data']) for item in page.get('Items', []))
            key = page.get('LastEvaluatedKey')
            if not key:
                break
            if scanned >= scan_budget:
                raise RuntimeError('Item listing scan budget exceeded')
            params['ExclusiveStartKey'] = key
        # Legacy records have no creation timestamp and rank after newer ones.
        records.sort(key=lambda item: (item.get('createdAt', 0), item['id']), reverse=True)
        return records[:limit]

    def list(self, kind, limit=100, session_id=None):
        # DynamoDB Limit counts evaluated records, not matching records. A filtered
        # empty page can still have a continuation key; follow it until the cap.
        params = {'FilterExpression': '#kind = :kind', 'ExpressionAttributeNames': {'#kind': 'kind'},
                  'ExpressionAttributeValues': {':kind': kind}, 'ConsistentRead': True}
        if session_id is not None:
            params['FilterExpression'] += ' AND #owner = :owner'
            params['ExpressionAttributeNames']['#owner'] = 'owner'
            params['ExpressionAttributeValues'][':owner'] = session_id
        records = []
        while True:
            page = self.table.scan(**params)
            records.extend(json.loads(item['data']) for item in page.get('Items', []))
            if len(records) >= limit or not page.get('LastEvaluatedKey'):
                return records[:limit]
            params['ExclusiveStartKey'] = page['LastEvaluatedKey']
