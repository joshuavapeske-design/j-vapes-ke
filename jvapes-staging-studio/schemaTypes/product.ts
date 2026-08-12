import { defineType, defineField } from 'sanity'

export const product = defineType({
  name: 'product',
  title: 'All Products',
  type: 'document',
  fields: [
    defineField({
      name: 'name',
      title: 'Product Name',
      type: 'string',
    }),
    defineField({
      name: 'brand',
      title: 'Brand',
      type: 'string',
    }),
    defineField({
      name: 'price',
      title: 'Price (KES)',
      type: 'number',
    }),
    defineField({
      name: 'productType',
      title: 'Product Classification',
      type: 'string',
      options: {
        list: [
          { title: 'Disposable Vape', value: 'disposable' },
          { title: 'Starter Kit', value: 'starterKit' },
          { title: 'Replacement Pod', value: 'replacementPod' }
        ],
        layout: 'dropdown'
      },
      initialValue: 'disposable'
    }),
    defineField({
      name: 'puffs',
      title: 'Puff Count (If Disposable)',
      type: 'number',
    }),
    defineField({
      name: 'flavors',
      title: 'Available / Compatible Flavors',
      type: 'array',
      of: [{ type: 'string' }],
    }),
    defineField({
      name: 'image',
      title: 'Product Image',
      type: 'image',
      options: { hotspot: true }
    }),
    defineField({
      name: 'stock',
      title: 'In Stock Count',
      type: 'number',
      initialValue: 10,
    }),
    defineField({
      name: 'description',
      title: 'Description (Rich Text Specification)',
      type: 'array',
      of: [{ type: 'block' }]
    })
  ]
})