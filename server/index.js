const cors = require('cors')
const express = require('express')
const db = require('./db')

const app = express()
app.use(cors())
app.use(express.json())

app.use(async (req, res, next) => {
  try {
    await db.ready
    next()
  } catch (error) {
    next(error)
  }
})

function parseSale (row) {
  return {
    ...row,
    items: JSON.parse(row.items),
  }
}

function parseCart (row) {
  return row ? JSON.parse(row.items) : []
}

app.get('/api/categories', async (req, res) => {
  try {
    const rows = await db.all('SELECT * FROM categories ORDER BY id ASC')
    res.json(rows)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Failed to fetch categories' })
  }
})

app.get('/api/products', async (req, res) => {
  try {
    const rows = await db.all(`
      SELECT products.*, categories.name AS categoryName
      FROM products
      LEFT JOIN categories ON categories.id = products.categoryId
      ORDER BY products.id ASC
    `)
    res.json(rows.map(row => ({ ...row, categoryName: row.categoryName || 'Uncategorized' })))
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Failed to fetch products' })
  }
})

app.get('/api/cart', async (req, res) => {
  try {
    const row = await db.get('SELECT items FROM carts WHERE id = ?', 'default')
    res.json(parseCart(row))
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Failed to fetch cart' })
  }
})

app.put('/api/cart', async (req, res) => {
  const items = Array.isArray(req.body) ? req.body : []

  try {
    await db.run(
      `INSERT INTO carts (id, items) VALUES (?, ?)
       ON CONFLICT(id) DO UPDATE SET items = excluded.items`,
      'default',
      JSON.stringify(items),
    )
    res.json({ success: true })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Failed to save cart' })
  }
})

app.get('/api/sales', async (req, res) => {
  try {
    const rows = await db.all('SELECT * FROM sales ORDER BY date DESC')
    res.json(rows.map(row => parseSale(row)))
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Failed to fetch sales' })
  }
})

app.post('/api/sales', async (req, res) => {
  const sale = req.body

  if (!sale || !Array.isArray(sale.items) || sale.items.length === 0) {
    return res.status(400).json({ error: 'Invalid sale data' })
  }

  try {
    await db.run('BEGIN TRANSACTION')

    await db.run(
      `INSERT INTO sales (id, date, items, subtotal, discount, tax, grandTotal, paymentMethod)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
        date = excluded.date,
        items = excluded.items,
        subtotal = excluded.subtotal,
        discount = excluded.discount,
        tax = excluded.tax,
        grandTotal = excluded.grandTotal,
        paymentMethod = excluded.paymentMethod`,
      sale.id,
      sale.date,
      JSON.stringify(sale.items),
      sale.subtotal,
      sale.discount,
      sale.tax,
      sale.grandTotal,
      sale.paymentMethod,
    )

    for (const item of sale.items) {
      const product = await db.get('SELECT stock FROM products WHERE id = ?', item.productId)
      if (!product) {
        throw new Error(`Product ${item.productId} was not found`)
      }
      if (product.stock < item.quantity) {
        throw new Error(`Only ${product.stock} items available for ${item.name}`)
      }

      await db.run(
        'UPDATE products SET stock = stock - ? WHERE id = ?',
        item.quantity,
        item.productId,
      )
    }

    await db.run('UPDATE carts SET items = ? WHERE id = ?', JSON.stringify([]), 'default')
    await db.run('COMMIT')

    res.status(201).json({ success: true })
  } catch (error) {
    await db.run('ROLLBACK').catch(() => {})
    console.error(error)
    res.status(500).json({ error: error.message || 'Failed to add sale' })
  }
})

// Express error middleware requires four arguments.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err)
  res.status(500).json({ error: 'Server failed to initialize' })
})

const PORT = process.env.PORT || 4000
app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`)
})
