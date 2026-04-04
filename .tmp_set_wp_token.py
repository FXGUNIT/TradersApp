import os
import sqlite3

token = os.environ['WP_TOKEN']
con = sqlite3.connect('/data/woodpecker.sqlite')
cur = con.cursor()
cur.execute('update users set hash=? where id=1', (token,))
con.commit()
print('updated')
