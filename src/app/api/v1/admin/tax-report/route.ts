import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { getTaxReport, taxReportToCsv, type FopGroup } from '@/services/tax-report';
import { logger } from '@/lib/logger';

const querySchema = z.object({
  year: z.coerce.number().int().min(2020).max(2100),
  quarter: z.coerce.number().int().min(1).max(4).optional(),
  group: z.coerce.number().int().min(1).max(3),
  rate: z.coerce.number().min(0).max(100).optional(),
  fixedTax: z.coerce.number().min(0).optional(),
  format: z.enum(['json', 'csv']).optional(),
});

// GET — build the income report for a period/group. `?format=csv` downloads it.
export const GET = withRole('admin')(async (request: NextRequest) => {
  try {
    const params = Object.fromEntries(request.nextUrl.searchParams);
    const parsed = querySchema.safeParse(params);
    if (!parsed.success) return errorResponse(parsed.error.issues[0].message, 422);

    const report = await getTaxReport({
      year: parsed.data.year,
      quarter: parsed.data.quarter as 1 | 2 | 3 | 4 | undefined,
      group: parsed.data.group as FopGroup,
      ratePercent: parsed.data.rate,
      fixedTax: parsed.data.fixedTax,
    });

    if (parsed.data.format === 'csv') {
      // Prepend BOM so Ukrainian Excel opens UTF-8 correctly.
      const csv = '﻿' + taxReportToCsv(report);
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="fop-${report.periodLabel.replace(/\s+/g, '-')}.csv"`,
        },
      });
    }
    return successResponse(report);
  } catch (err) {
    logger.error('[admin/tax-report] GET failed', { error: err });
    return errorResponse('Помилка формування звіту', 500);
  }
});

// PUT — save ФОП identity settings (TIN/name/default group/rate). Point 1.
const settingsSchema = z.object({
  tin: z.string().max(20).optional(),
  name: z.string().max(200).optional(),
  defaultGroup: z.coerce.number().int().min(1).max(3).optional(),
  ratePercent: z.coerce.number().min(0).max(100).optional(),
  incomeLimit: z.coerce.number().min(0).optional(),
});

export const PUT = withRole('admin')(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const parsed = settingsSchema.safeParse(body);
    if (!parsed.success) return errorResponse(parsed.error.issues[0].message, 422);

    const entries: Array<[string, string]> = [];
    if (parsed.data.tin !== undefined) entries.push(['fop_tin', parsed.data.tin]);
    if (parsed.data.name !== undefined) entries.push(['fop_name', parsed.data.name]);
    if (parsed.data.defaultGroup !== undefined)
      entries.push(['fop_default_group', String(parsed.data.defaultGroup)]);
    if (parsed.data.ratePercent !== undefined)
      entries.push(['fop_rate_percent', String(parsed.data.ratePercent)]);
    if (parsed.data.incomeLimit !== undefined)
      entries.push(['fop_income_limit', String(parsed.data.incomeLimit)]);

    await Promise.all(
      entries.map(([key, value]) =>
        prisma.siteSetting.upsert({ where: { key }, create: { key, value }, update: { value } }),
      ),
    );
    return successResponse({ saved: entries.length });
  } catch (err) {
    logger.error('[admin/tax-report] PUT failed', { error: err });
    return errorResponse('Помилка збереження налаштувань', 500);
  }
});

// GET current ФОП settings is folded into the report response (tin/name); the
// page reads defaults via a tiny settings fetch below for the form pre-fill.
export const POST = withRole('admin')(async () => {
  try {
    const settings = await prisma.siteSetting.findMany({
      where: {
        key: {
          in: ['fop_tin', 'fop_name', 'fop_default_group', 'fop_rate_percent', 'fop_income_limit'],
        },
      },
      select: { key: true, value: true },
    });
    const map = new Map(settings.map((s) => [s.key, s.value]));
    return successResponse({
      tin: map.get('fop_tin') ?? '',
      name: map.get('fop_name') ?? '',
      defaultGroup: Number(map.get('fop_default_group') ?? 3),
      ratePercent: Number(map.get('fop_rate_percent') ?? 5),
      incomeLimit: Number(map.get('fop_income_limit') ?? 0),
    });
  } catch (err) {
    logger.error('[admin/tax-report] POST(settings) failed', { error: err });
    return errorResponse('Помилка читання налаштувань', 500);
  }
});
