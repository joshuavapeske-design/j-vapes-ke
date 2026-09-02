import { defineType, defineField } from 'sanity'

export const article = defineType({
  name: 'article',
  title: 'Guides & Articles',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: 'Article Title',
      type: 'string',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'slug',
      title: 'URL Slug',
      type: 'slug',
      options: {
        source: 'title',
        maxLength: 96,
      },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'publishedAt',
      title: 'Published At',
      type: 'datetime',
      initialValue: () => new Date().toISOString(),
    }),
    defineField({
      name: 'author',
      title: 'Author',
      type: 'string',
      initialValue: 'JVAPES Editorial Team',
    }),
    defineField({
      name: 'coverImage',
      title: 'Cover / Feature Image',
      type: 'image',
      options: { hotspot: true },
    }),
    defineField({
      name: 'excerpt',
      title: 'Short Excerpt / Summary',
      type: 'text',
      rows: 3,
    }),
    defineField({
      name: 'body',
      title: 'Article Body',
      type: 'array',
      of: [{ type: 'block' }],
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
      name: 'ogImage',
      title: 'Open Graph Image',
      type: 'image',
      options: { hotspot: true },
    }),
    defineField({
      name: 'noIndex',
      title: 'Hide from search engines (noindex)',
      type: 'boolean',
      initialValue: false,
    }),
  ],
})
