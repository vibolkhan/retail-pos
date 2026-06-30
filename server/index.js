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

function parseProduct (row) {
  return {
    ...row,
    categoryName: row.categoryName || 'Uncategorized',
    isActive: Boolean(row.isActive),
  }
}

function readProductInput (body) {
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const code = typeof body.code === 'string' ? body.code.trim() : ''
  const barcode = typeof body.barcode === 'string' ? body.barcode.trim() : ''
  const image = typeof body.image === 'string' ? body.image.trim() : ''
  const categoryId = Number(body.categoryId)
  const price = Number(body.price)
  const stock = Number(body.stock)
  const isActive = typeof body.isActive === 'boolean' ? body.isActive : true

  if (!name) {
    return { error: 'Product name is required' }
  }
  if (!code) {
    return { error: 'Product code is required' }
  }
  if (!barcode) {
    return { error: 'Barcode is required' }
  }
  if (!Number.isInteger(categoryId) || categoryId <= 0) {
    return { error: 'Category is required' }
  }
  if (!Number.isFinite(price) || price < 0) {
    return { error: 'Price must be zero or higher' }
  }
  if (!Number.isInteger(stock) || stock < 0) {
    return { error: 'Stock must be a non-negative whole number' }
  }
  if (!image) {
    return { error: 'Product image is required' }
  }

  return {
    product: {
      name,
      code,
      barcode,
      categoryId,
      price,
      stock,
      image,
      isActive,
    },
  }
}

async function ensureCategoryExists (categoryId) {
  return db.get('SELECT id FROM categories WHERE id = ?', categoryId)
}

async function findProduct (productId) {
  const row = await db.get(`
    SELECT products.*, categories.name AS categoryName
    FROM products
    LEFT JOIN categories ON categories.id = products.categoryId
    WHERE products.id = ?
  `, productId)

  return row ? parseProduct(row) : null
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
  const includeInactive = req.query.includeInactive === 'true'

  try {
    const rows = await db.all(`
      SELECT products.*, categories.name AS categoryName
      FROM products
      LEFT JOIN categories ON categories.id = products.categoryId
      WHERE ? OR products.isActive = 1
      ORDER BY products.id ASC
    `, includeInactive ? 1 : 0)
    res.json(rows.map(row => parseProduct(row)))
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Failed to fetch products' })
  }
})

app.post('/api/products', async (req, res) => {
  const input = readProductInput(req.body)

  if (input.error) {
    return res.status(400).json({ error: input.error })
  }

  try {
    const category = await ensureCategoryExists(input.product.categoryId)
    if (!category) {
      return res.status(400).json({ error: 'Category was not found' })
    }

    const result = await db.run(
      `INSERT INTO products (name, code, barcode, categoryId, price, stock, image, isActive)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      input.product.name,
      input.product.code,
      input.product.barcode,
      input.product.categoryId,
      input.product.price,
      input.product.stock,
      input.product.image,
      input.product.isActive ? 1 : 0,
    )

    const product = await findProduct(result.lastID)
    res.status(201).json(product)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Failed to create product' })
  }
})

app.patch('/api/products/:id', async (req, res) => {
  const productId = Number(req.params.id)
  const input = readProductInput(req.body)

  if (!Number.isInteger(productId) || productId <= 0) {
    return res.status(400).json({ error: 'Invalid product id' })
  }
  if (input.error) {
    return res.status(400).json({ error: input.error })
  }

  try {
    const category = await ensureCategoryExists(input.product.categoryId)
    if (!category) {
      return res.status(400).json({ error: 'Category was not found' })
    }

    const result = await db.run(
      `UPDATE products
       SET name = ?, code = ?, barcode = ?, categoryId = ?, price = ?, stock = ?, image = ?, isActive = ?
       WHERE id = ?`,
      input.product.name,
      input.product.code,
      input.product.barcode,
      input.product.categoryId,
      input.product.price,
      input.product.stock,
      input.product.image,
      input.product.isActive ? 1 : 0,
      productId,
    )

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Product was not found' })
    }

    const product = await findProduct(productId)
    res.json(product)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Failed to update product' })
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
