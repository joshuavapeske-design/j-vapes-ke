import { defineType, defineField } from 'sanity'

export const promo = defineType({
  name: 'promo',
  title: 'Storewide Promotions',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: 'Promotion Title',
      type: 'string',
    }),
    defineField({
      name: 'discountPercentage',
      title: 'Discount Percentage (%)',
      type: 'number',
    }),
    defineField({
      name: 'productRef',
      title: 'Target Product for Discount',
      type: 'reference',
      to: [{ type: 'product' }] // Points cleanly to our single product schema mapping
    })
  ]
})