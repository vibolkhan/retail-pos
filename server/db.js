const fs = require('node:fs')
const path = require('node:path')
const sqlite3 = require('sqlite3').verbose()

const dataDir = path.resolve(__dirname, 'data')
fs.mkdirSync(dataDir, { recursive: true })

const dbPath = path.resolve(dataDir, 'db.sqlite')
let readyResolve
let readyReject
const ready = new Promise((resolve, reject) => {
  readyResolve = resolve
  readyReject = reject
})

const db = new sqlite3.Database(dbPath, err => {
  if (err) {
    console.error('Failed to open SQLite DB:', err)
    readyReject(err)
  } else {
    console.log('SQLite DB opened at', dbPath)
    initialize()
      .then(readyResolve)
      .catch(error => {
        console.error('Failed to initialize SQLite DB:', error)
        readyReject(error)
      })
  }
})

function normalizeParams (params) {
  if (params.length === 0) {
    return []
  }
  if (params.length === 1 && Array.isArray(params[0])) {
    return params[0]
  }
  return params
}

function run (sql, ...params) {
  return new Promise((resolve, reject) => {
    db.run(sql, normalizeParams(params), function (err) {
      if (err) {
        reject(err)
      } else {
        // sqlite3 exposes lastID/changes on the statement callback context.
        // eslint-disable-next-line unicorn/no-this-outside-of-class
        resolve({ lastID: this.lastID, changes: this.changes })
      }
    })
  })
}

function all (sql, ...params) {
  return new Promise((resolve, reject) => {
    db.all(sql, normalizeParams(params), (err, rows) => {
      if (err) {
        reject(err)
      } else {
        resolve(rows)
      }
    })
  })
}

function get (sql, ...params) {
  return new Promise((resolve, reject) => {
    db.get(sql, normalizeParams(params), (err, row) => {
      if (err) {
        reject(err)
      } else {
        resolve(row)
      }
    })
  })
}

function loadSeedFile (fileName, fallback = []) {
  const filePath = path.resolve(__dirname, '..', 'public', 'data', fileName)

  if (!fs.existsSync(filePath)) {
    return fallback
  }

  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

async function seedCategories () {
  const row = await get('SELECT COUNT(*) AS count FROM categories')
  if (row.count > 0) {
    return
  }

  const categories = loadSeedFile('categories.json')
  for (const category of categories) {
    await run('INSERT INTO categories (id, name) VALUES (?, ?)', category.id, category.name)
  }
}

async function seedProducts () {
  const row = await get('SELECT COUNT(*) AS count FROM products')
  if (row.count > 0) {
    return
  }

  const products = loadSeedFile('products.json')
  for (const product of products) {
    await run(
      `INSERT INTO products (id, name, code, barcode, categoryId, price, stock, image, isActive)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      product.id,
      product.name,
      product.code,
      product.barcode,
      product.categoryId,
      product.price,
      product.stock,
      product.image,
      product.isActive === false ? 0 : 1,
    )
  }
}

async function seedSales () {
  const row = await get('SELECT COUNT(*) AS count FROM sales')
  if (row.count > 0) {
    return
  }

  const sales = loadSeedFile('sales.json')
  for (const sale of sales) {
    await insertSaleLike('sales', sale)
  }
}

async function seedCart () {
  const row = await get('SELECT COUNT(*) AS count FROM carts')
  if (row.count > 0) {
    return
  }

  const carts = loadSeedFile('carts.json')
  await run('INSERT INTO carts (id, items) VALUES (?, ?)', 'default', JSON.stringify(carts))
}

async function migrateProductVisibility () {
  const columns = await all('PRAGMA table_info(products)')
  const hasIsActive = columns.some(column => column.name === 'isActive')

  if (!hasIsActive) {
    await run('ALTER TABLE products ADD COLUMN isActive INTEGER NOT NULL DEFAULT 1')
  }
}

async function migrateOrdersToSales () {
  const table = await get('SELECT name FROM sqlite_master WHERE type = ? AND name = ?', 'table', 'orders')
  if (!table) {
    return
  }

  await run(`INSERT OR IGNORE INTO sales (id, date, items, subtotal, discount, tax, grandTotal, paymentMethod)
    SELECT id, date, items, subtotal, discount, tax, grandTotal, paymentMethod FROM orders`)
  await run('DROP TABLE orders')
}

async function insertSaleLike (table, sale) {
  await run(
    `INSERT INTO ${table} (id, date, items, subtotal, discount, tax, grandTotal, paymentMethod)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    sale.id,
    sale.date,
    JSON.stringify(sale.items),
    sale.subtotal,
    sale.discount,
    sale.tax,
    sale.grandTotal,
    sale.paymentMethod,
  )
}

async function initialize () {
  await run(`CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL
  )`)

  await run(`CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    barcode TEXT NOT NULL,
    categoryId INTEGER NOT NULL,
    price REAL NOT NULL,
    stock INTEGER NOT NULL,
    image TEXT NOT NULL,
    isActive INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY (categoryId) REFERENCES categories(id)
  )`)

  await run(`CREATE TABLE IF NOT EXISTS carts (
    id TEXT PRIMARY KEY,
    items TEXT NOT NULL
  )`)

  await run(`CREATE TABLE IF NOT EXISTS sales (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    items TEXT NOT NULL,
    subtotal REAL NOT NULL,
    discount REAL NOT NULL,
    tax REAL NOT NULL,
    grandTotal REAL NOT NULL,
    paymentMethod TEXT NOT NULL
  )`)

  await seedCategories()
  await seedProducts()
  await migrateProductVisibility()
  await seedSales()
  await seedCart()
  await migrateOrdersToSales()
}

module.exports = { run, all, get, initialize, ready }
