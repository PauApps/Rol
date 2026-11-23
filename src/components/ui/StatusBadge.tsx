import { Badge, type BadgeTone } from './Badge';
import type { CampaignStatus, MemberStatus, UserStatus } from '@/db/schema';

const CAMPAIGN_STATUS_MAP: Record<CampaignStatus, { label: string; tone: BadgeTone }> = {
  active: { label: 'Activa', tone: 'success' },
  paused: { label: 'Pausada', tone: 'warning' },
  finished: { label: 'Finalitzada', tone: 'neutral' },
};

const USER_STATUS_MAP: Record<UserStatus, { label: string; tone: BadgeTone }> = {
  active: { label: 'Actiu', tone: 'success' },
  blocked: { label: 'Bloquejat', tone: 'danger' },
  disabled: { label: 'Desactivat', tone: 'neutral' },
};

const MEMBER_STATUS_MAP: Record<MemberStatus, { label: string; tone: BadgeTone }> = {
  active: { label: 'Actiu', tone: 'success' },
  revoked: { label: 'Revocat', tone: 'danger' },
};

export function CampaignStatusBadge({ status }: { status: CampaignStatus }) {
  const cfg = CAMPAIGN_STATUS_MAP[status];
  return <Badge tone={cfg.tone}>{cfg.label}</Badge>;
}

export function UserStatusBadge({ status }: { status: UserStatus }) {
  const cfg = USER_STATUS_MAP[status];
  return <Badge tone={cfg.tone}>{cfg.label}</Badge>;
}

export function MemberStatusBadge({ status }: { status: MemberStatus }) {
  const cfg = MEMBER_STATUS_MAP[status];
  return <Badge tone={cfg.tone}>{cfg.label}</Badge>;
}
