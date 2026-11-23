import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb } from '@/db';
import { campaignCreationConfigSchema } from '@/domain/campaigns/creation-config';
import { getServerAuthContext } from '@/server/auth/session';
import { assertUuid, handleApiError, parseJsonBody } from '@/server/http';
import { updateCampaignCharacterRules } from '@/server/services/campaign-service';

export const dynamic = 'force-dynamic';

const updateRulesSchema = z.object({
  creationConfig: campaignCreationConfigSchema.partial().optional(),
  maxCharactersPerPlayer: z
    .number()
    .int('El límit ha de ser un nombre enter.')
    .min(1, 'El límit mínim és 1 personatge.')
    .max(50, 'El límit màxim és 50 personatges.')
    .nullable()
    .optional(),
  virtualDiceEnabled: z.boolean().optional(),
});

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    assertUuid(id, 'campanya');
    const body = await parseJsonBody(request, updateRulesSchema);
    const ctx = await getServerAuthContext();
    const db = await getDb();
    const campaign = await updateCampaignCharacterRules(db, ctx, id, body);
    return NextResponse.json({
      campaign: {
        id: campaign.id,
        creationConfig: campaign.creationConfig,
        maxCharactersPerPlayer: campaign.maxCharactersPerPlayer,
        virtualDiceEnabled: campaign.virtualDiceEnabled,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
