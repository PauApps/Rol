export type SupportedLocale = 'ca' | 'es' | 'en';

export interface TranslationDictionary {
  appName: string;
  tagline: string;
  nav: {
    campaigns: string;
    admin: string;
    trash: string;
    charactersUpcoming: string;
    manualsUpcoming: string;
    logout: string;
    collapseSidebar: string;
    expandSidebar: string;
    openMenu: string;
    closeMenu: string;
  };
  auth: {
    loginTitle: string;
    loginSubtitle: string;
    email: string;
    password: string;
    submitLogin: string;
    closedRegistrationNotice: string;
    gmInviteTitle: string;
    gmInviteSubtitle: string;
    displayName: string;
    submitGmRegister: string;
    playerInviteTitle: string;
    guestTab: string;
    registerTab: string;
    loginTab: string;
    guestAliasLabel: string;
    guestAliasHint: string;
    joinAsGuest: string;
    createAccountAndJoin: string;
    loginAndJoin: string;
    recoveryTitle: string;
    recoverySubtitle: string;
    recoverAccessButton: string;
  };
  admin: {
    title: string;
    subtitle: string;
    inviteGmTitle: string;
    inviteGmButton: string;
    gmInvitationsList: string;
    usersTitle: string;
    auditTitle: string;
    blockUser: string;
    disableUser: string;
    reactivateUser: string;
    revokeInvite: string;
  };
  campaigns: {
    title: string;
    emptyTitle: string;
    emptyDescription: string;
    createFirstButton: string;
    createButton: string;
    createModalTitle: string;
    campaignName: string;
    gameSystem: string;
    description: string;
    statusLabel: string;
    statuses: {
      active: string;
      paused: string;
      finished: string;
    };
    trashTab: string;
    activeTab: string;
    moveToTrash: string;
    restoreCampaign: string;
    purgeForever: string;
    purgeConfirmHint: string;
    playersCount: string;
    charactersCount: string;
    recentActivity: string;
    invitationsAndPlayers: string;
    createPlayerInvite: string;
    inviteLabelPlaceholder: string;
    generateRecoveryLink: string;
    revokeMember: string;
    charactersSectionTitle: string;
    charactersPhaseNotice: string;
  };
  common: {
    loading: string;
    save: string;
    cancel: string;
    copy: string;
    copied: string;
    upcomingBadge: string;
    roleLabels: {
      admin: string;
      gm: string;
      player: string;
      guest: string;
    };
    userStatusLabels: {
      active: string;
      blocked: string;
      disabled: string;
    };
  };
}
