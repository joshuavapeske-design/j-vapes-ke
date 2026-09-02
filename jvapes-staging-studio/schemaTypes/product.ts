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
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'slug',
      title: 'URL Slug',
      type: 'slug',
      options: {
        source: 'name',
        maxLength: 96,
      },
      validation: (Rule) => Rule.required(),
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
    }),
    // SEO Fields
    defineField({
      name: 'seoTitle',
      title: 'SEO Title (Max 60 chars)',
      type: 'string',
      validation: (Rule) => Rule.max(60),
    }),
    defineField({
      name: 'metaDescription',
      title: 'Meta Description (Max 160 chars)',
      type: 'text',
      rows: 3,
      validation: (Rule) => Rule.max(160),
    }),
    defineField({
      name: 'canonicalUrl',
      title: 'Canonical URL Override',
      type: 'url',
    }),
    defineField({
      name: 'ogTitle',
      title: 'Open Graph Title (WhatsApp / Social)',
      type: 'string',
    }),
    defineField({
      name: 'ogDescription',
      title: 'Open Graph Description',
      type: 'text',
      rows: 2,
    }),
    defineField({
      name: 'ogImage',
      title: 'Open Graph Image (1200x630)',
      type: 'image',
      options: { hotspot: true }
    }),
    defineField({
      name: 'noIndex',
      title: 'Hide from search engines (noindex)',
      type: 'boolean',
      initialValue: false,
    })
  ]
})