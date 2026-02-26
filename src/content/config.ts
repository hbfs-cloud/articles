import { defineCollection, z } from 'astro:content';

const badgeSchema = z.object({
  text: z.string(),
  type: z.enum(['red', 'green', 'blue', 'purple']),
  icon: z.string().optional(),
});

const navItemSchema = z.object({
  href: z.string(),
  icon: z.string(),
  label: z.string(),
});

const metricSchema = z.object({
  label: z.string(),
  value: z.string(),
  change: z.string().optional(),
  direction: z.enum(['up', 'down', 'neutral']).optional(),
});

/**
 * Daily Briefings collection.
 * LLMs produce .mdx files with this frontmatter — layout handles the rest.
 */
const heroBadgeSchema = z.object({
  text: z.string(),
  color: z.enum(['red', 'green', 'blue', 'purple', 'amber', 'silver']),
  icon: z.string().optional(),
});

const daily = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    subtitle: z.string().optional(),
    dateLine: z.string(),
    dateColor: z.string().optional(),
    heroGradient: z.string().optional(),
    date: z.string(),
    description: z.string().optional(),
    lang: z.string().default('fr'),
    tags: z.array(z.string()),
    badges: z.array(heroBadgeSchema).default([]),
    navItems: z.array(navItemSchema.extend({ color: z.string().optional() })).default([]),
  }),
});

/**
 * Individual Analyses collection.
 */
const analyses = defineCollection({
  type: 'content',
  schema: z.object({
    ticker: z.string(),
    name: z.string(),
    exchange: z.string().optional(),
    price: z.string(),
    priceChange: z.string(),
    grade: z.string().optional(),
    date: z.string(),
    description: z.string().optional(),
    lang: z.string().default('fr'),
    level: z.enum(['expert', 'beginner']).default('expert'),
    tags: z.array(z.string()),
    metrics: z.array(metricSchema).default([]),
    badges: z.array(badgeSchema).default([]),
  }),
});

/**
 * Weekly Reports collection.
 */
const weekly = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    subtitle: z.string(),
    weekRange: z.string(),
    date: z.string(),
    description: z.string().optional(),
    lang: z.string().default('fr'),
    tags: z.array(z.string()),
    badges: z.array(badgeSchema).default([]),
    navItems: z.array(navItemSchema).default([]),
  }),
});

/**
 * Scanner Scans collection.
 */
const scanner = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    subtitle: z.string(),
    date: z.string(),
    description: z.string().optional(),
    lang: z.string().default('fr'),
    tags: z.array(z.string()),
    regime: z.string().optional(),
    badges: z.array(badgeSchema).default([]),
    isRetrospective: z.boolean().default(false),
  }),
});

/**
 * Tech Articles collection (series, guides, deep dives).
 */
const seriesStepSchema = z.object({
  label: z.string(),
  href: z.string(),
  current: z.boolean().optional(),
});

const sectionSchema = z.object({
  id: z.string(),
  icon: z.string().optional(),
  label: z.string(),
});

const tech = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    subtitle: z.string().optional(),
    dateLine: z.string().optional(),
    dateColor: z.string().optional(),
    heroGradient: z.string().optional(),
    date: z.string(),
    description: z.string().optional(),
    lang: z.string().default('en'),
    tags: z.array(z.string()),
    badges: z.array(heroBadgeSchema).default([]),
    sections: z.array(sectionSchema).default([]),
    series: z.object({
      title: z.string(),
      steps: z.array(seriesStepSchema),
    }).optional(),
  }),
});

export const collections = { daily, analyses, weekly, scanner, tech };
