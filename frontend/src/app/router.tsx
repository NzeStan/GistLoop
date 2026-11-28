import { type ComponentType, lazy } from "react";
import { createBrowserRouter, Navigate, type RouteObject } from "react-router";

import { AuthLayout, MarketingLayout, RootLayout } from "@/components/layout/Layouts";
import { NotFoundPage, RouteErrorPage } from "@/features/marketing/ErrorPages";

import { AdaptiveLayout, Guest, Protected } from "./RouteLayouts";

/** Code-split a named export: one small chunk per page. */
function page<M extends Record<string, unknown>>(load: () => Promise<M>, name: keyof M = "default") {
  return lazy(async () => ({ default: (await load())[name] as ComponentType }));
}

const marketing = () => import("@/features/marketing/CompanyPages");
const legal = () => import("@/features/marketing/LegalPages");
const utility = () => import("@/features/marketing/UtilityPages");
const auth = () => import("@/features/auth/AuthPages");
const settings = () => import("@/features/settings/SettingsPages");
const feedTags = () => import("@/features/feed/TagPages");
const gist = () => import("@/features/gist/GistPages");
const events = () => import("@/features/events/EventPage");
const market = () => import("@/features/marketplace/MarketplacePages");
const selling = () => import("@/features/marketplace/SellPages");
const organising = () => import("@/features/events/OrganiserPages");
const podcasts = () => import("@/features/podcasts/PodcastPages");
const notifications = () => import("@/features/discovery/NotificationsPage");
const profile = () => import("@/features/profile/ProfilePage");
const inbox = () => import("@/features/inbox/InboxPages");
const messages = () => import("@/features/messages/MessagesPages");
const opportunities = () => import("@/features/opportunities/OpportunityPages");
const promote = () => import("@/features/promotions/PromotePages");
const schools = () => import("@/features/schools/SchoolPages");
const people = () => import("@/features/profile/PeoplePages");

const HomePage = page(() => import("@/features/marketing/HomePage"));
const AboutPage = page(marketing, "AboutPage");
const FeaturesPage = page(marketing, "FeaturesPage");
const HelpPage = page(marketing, "HelpPage");
const CareersPage = page(marketing, "CareersPage");
const PressPage = page(marketing, "PressPage");
const SafetyPage = page(marketing, "SafetyPage");
const ContactPage = page(() => import("@/features/marketing/ContactPage"));
const TermsPage = page(legal, "TermsPage");
const PrivacyPage = page(legal, "PrivacyPage");
const CookiesPage = page(legal, "CookiesPage");
const GuidelinesPage = page(legal, "GuidelinesPage");
const NewsletterConfirmPage = page(utility, "NewsletterConfirmPage");
const NewsletterUnsubscribePage = page(utility, "NewsletterUnsubscribePage");
const PaymentReturnPage = page(utility, "PaymentReturnPage");

const LoginPage = page(auth, "LoginPage");
const RegisterPage = page(auth, "RegisterPage");
const ForgotPasswordPage = page(auth, "ForgotPasswordPage");
const ResetPasswordPage = page(auth, "ResetPasswordPage");
const VerifyEmailPage = page(auth, "VerifyEmailPage");
const ConfirmEmailChangePage = page(auth, "ConfirmEmailChangePage");

const FeedPage = page(() => import("@/features/feed/FeedPage"));
const PostPage = page(() => import("@/features/feed/PostPage"));
const HashtagPage = page(feedTags, "HashtagPage");
const BookmarksPage = page(feedTags, "BookmarksPage");
const SearchPage = page(() => import("@/features/discovery/SearchPage"));
const NotificationsPage = page(notifications);
const NotificationOpenPage = page(notifications, "NotificationOpenPage");
const CommunitiesPage = page(() => import("@/features/communities/CommunitiesPage"));
const CommunityPage = page(() => import("@/features/communities/CommunityPage"));
const GistHubPage = page(gist, "GistHubPage");
const GistPostPage = page(gist, "GistPostPage");
const EventsPage = page(() => import("@/features/events/EventsPage"));
const EventPage = page(events);
const EventByIdPage = page(events, "EventByIdPage");
const MarketplacePage = page(market);
const ListingPage = page(market, "ListingPage");
const SellPage = page(selling, "SellPage");
const OrdersPage = page(selling, "OrdersPage");
const CreateEventPage = page(organising, "CreateEventPage");
const MyTicketsPage = page(organising, "MyTicketsPage");
const PodcastsPage = page(podcasts);
const PodcastPage = page(podcasts, "PodcastPage");
const PodcastShowRedirect = page(podcasts, "PodcastShowRedirect");
const PodcastEpisodeRedirect = page(podcasts, "PodcastEpisodeRedirect");
const ProfilePage = page(profile);
const InboxPage = page(inbox, "InboxPage");
const AskPage = page(inbox, "AskPage");
const MessagesPage = page(messages, "MessagesPage");
const NewMessagePage = page(messages, "NewMessagePage");
const ConversationPage = page(messages, "ConversationPage");
const OpportunitiesPage = page(opportunities);
const OpportunityPage = page(opportunities, "OpportunityPage");
const PostOpportunityPage = page(opportunities, "PostOpportunityPage");
const MyOpportunitiesPage = page(opportunities, "MyOpportunitiesPage");
const ApplicantsPage = page(opportunities, "ApplicantsPage");
const AnnouncementsPage = page(() => import("@/features/announcements/AnnouncementsPage"));
const CampaignsPage = page(promote, "CampaignsPage");
const NewCampaignPage = page(promote, "NewCampaignPage");
const CampaignPage = page(promote, "CampaignPage");
const PremiumPage = page(() => import("@/features/premium/PremiumPage"));
const SchoolsPage = page(schools, "SchoolsPage");
const SchoolPage = page(schools, "SchoolPage");
const SchoolAdminPage = page(() => import("@/features/schools/SchoolAdmin"));
const MySchoolsSettings = page(() => import("@/features/schools/MySchools"));
const PeopleSettings = page(people, "PeopleSettings");
const FollowersPage = page(people, "FollowersPage");
const FollowingPage = page(people, "FollowingPage");
const OAuthCallbackPage = page(() => import("@/features/auth/SocialSignIn"), "OAuthCallbackPage");
const studio = () => import("@/features/podcasts/StudioPages");
const creator = () => import("@/features/creator/CreatorPages");
const manageCommunity = () => import("@/features/communities/ManageCommunity");
const manageEvent = () => import("@/features/events/ManageEvent");
const shops = () => import("@/features/marketplace/ShopPages");
const StudioHome = page(studio, "StudioHome");
const StudioShowPage = page(studio, "StudioShowPage");
const StudioEpisodePage = page(studio, "StudioEpisodePage");
const GuestSpotPage = page(studio, "GuestSpotPage");
const CreatorsPage = page(creator, "CreatorsPage");
const CreatorPage = page(creator, "CreatorPage");
const CreatorHubPage = page(creator, "CreatorHubPage");
const SponsorshipsPage = page(creator, "SponsorshipsPage");
const SponsorshipPage = page(creator, "SponsorshipPage");
const NewSponsorshipPage = page(creator, "NewSponsorshipPage");
const ManageCommunityPage = page(manageCommunity);
const CommunityInvitationsPage = page(manageCommunity, "CommunityInvitationsPage");
const JoinWithCodePage = page(manageCommunity, "JoinWithCodePage");
const MyEventsPage = page(manageEvent, "MyEventsPage");
const ManageEventPage = page(manageEvent, "ManageEventPage");
const SellerPage = page(shops, "SellerPage");
const OrderPage = page(shops, "OrderPage");
const StaffPage = page(() => import("@/features/staff/StaffPages"));
const WalletSettings = page(() => import("@/features/settings/WalletSettings"));
const SafetySettings = page(() => import("@/features/settings/SafetySettings"));
const SettingsLayout = page(() => import("@/features/settings/SettingsLayout"));
const ProfileSettings = page(settings, "ProfileSettings");
const AccountSettings = page(settings, "AccountSettings");
const PrivacySettings = page(settings, "PrivacySettings");
const NotificationSettings = page(settings, "NotificationSettings");
const SecuritySettings = page(settings, "SecuritySettings");
const DataSettings = page(settings, "DataSettings");

export const routes: RouteObject[] = [
  {
    element: <RootLayout />,
    errorElement: <RouteErrorPage />,
    children: [
      {
        element: <MarketingLayout />,
        children: [
          { index: true, element: <HomePage /> },
          { path: "about", element: <AboutPage /> },
          { path: "features", element: <FeaturesPage /> },
          { path: "contact", element: <ContactPage /> },
          { path: "help", element: <HelpPage /> },
          { path: "careers", element: <CareersPage /> },
          { path: "press", element: <PressPage /> },
          { path: "safety", element: <SafetyPage /> },
          { path: "terms", element: <TermsPage /> },
          { path: "privacy", element: <PrivacyPage /> },
          { path: "cookies", element: <CookiesPage /> },
          { path: "guidelines", element: <GuidelinesPage /> },
          { path: "newsletter/confirm", element: <NewsletterConfirmPage /> },
          { path: "newsletter/unsubscribe", element: <NewsletterUnsubscribePage /> },
          { path: "payments/return", element: <PaymentReturnPage /> },
        ],
      },
      {
        element: <AuthLayout />,
        children: [
          {
            element: <Guest />,
            children: [
              { path: "login", element: <LoginPage /> },
              { path: "register", element: <RegisterPage /> },
              { path: "forgot-password", element: <ForgotPasswordPage /> },
            ],
          },
          { path: "reset-password", element: <ResetPasswordPage /> },
          { path: "auth/callback/:provider", element: <OAuthCallbackPage /> },
          { path: "verify-email", element: <VerifyEmailPage /> },
          { path: "confirm-email", element: <ConfirmEmailChangePage /> },
        ],
      },
      {
        element: <AdaptiveLayout />,
        children: [
          { path: "communities", element: <CommunitiesPage /> },
          { path: "c/:communityId", element: <CommunityPage /> },
          { path: "events", element: <EventsPage /> },
          { path: "events/id/:eventId", element: <EventByIdPage /> },
          { path: "events/:slug", element: <EventPage /> },
          { path: "marketplace", element: <MarketplacePage /> },
          { path: "marketplace/:listingId", element: <ListingPage /> },
          { path: "podcasts", element: <PodcastsPage /> },
          { path: "podcasts/id/:podcastId", element: <PodcastShowRedirect /> },
          { path: "podcasts/episode/:episodeId", element: <PodcastEpisodeRedirect /> },
          { path: "podcasts/:slug", element: <PodcastPage /> },
          { path: "posts/:postId", element: <PostPage /> },
          { path: "tags/:tag", element: <HashtagPage /> },
          { path: "u/:handle", element: <ProfilePage /> },
          { path: "u/:handle/ask", element: <AskPage /> },
          { path: "u/:handle/followers", element: <FollowersPage /> },
          { path: "u/:handle/following", element: <FollowingPage /> },
          { path: "schools", element: <SchoolsPage /> },
          { path: "schools/:institutionId", element: <SchoolPage /> },
          { path: "opportunities", element: <OpportunitiesPage /> },
          { path: "opportunities/:opportunityId", element: <OpportunityPage /> },
          { path: "premium", element: <PremiumPage /> },
          { path: "creators", element: <CreatorsPage /> },
          { path: "creators/:handle", element: <CreatorPage /> },
          { path: "sponsorships", element: <SponsorshipsPage /> },
          { path: "sponsorships/:campaignId", element: <SponsorshipPage /> },
          { path: "sellers/:handle", element: <SellerPage /> },
          { path: "search", element: <SearchPage /> },
        ],
      },
      {
        element: <Protected />,
        children: [
          { path: "feed", element: <FeedPage /> },
          { path: "gist", element: <GistHubPage /> },
          { path: "gist/p/:postId", element: <GistPostPage /> },
          { path: "notifications", element: <NotificationsPage /> },
          { path: "notifications/:notificationId", element: <NotificationOpenPage /> },
          { path: "bookmarks", element: <BookmarksPage /> },
          { path: "marketplace/sell", element: <SellPage /> },
          { path: "marketplace/orders", element: <OrdersPage /> },
          { path: "events/new", element: <CreateEventPage /> },
          { path: "events/tickets", element: <MyTicketsPage /> },
          { path: "inbox", element: <InboxPage /> },
          { path: "messages", element: <MessagesPage /> },
          { path: "messages/new", element: <NewMessagePage /> },
          { path: "messages/:conversationId", element: <ConversationPage /> },
          { path: "announcements", element: <AnnouncementsPage /> },
          { path: "opportunities/new", element: <PostOpportunityPage /> },
          { path: "opportunities/mine", element: <MyOpportunitiesPage /> },
          { path: "opportunities/:opportunityId/applicants", element: <ApplicantsPage /> },
          { path: "promote", element: <CampaignsPage /> },
          { path: "promote/new", element: <NewCampaignPage /> },
          { path: "promote/:campaignId", element: <CampaignPage /> },
          { path: "schools/:institutionId/manage", element: <SchoolAdminPage /> },
          { path: "studio", element: <StudioHome /> },
          { path: "studio/:podcastId", element: <StudioShowPage /> },
          { path: "studio/:podcastId/episodes/:episodeId", element: <StudioEpisodePage /> },
          { path: "podcasts/guest-spots/:guestId", element: <GuestSpotPage /> },
          { path: "creator", element: <CreatorHubPage /> },
          { path: "sponsorships/new", element: <NewSponsorshipPage /> },
          { path: "c/:communityId/manage", element: <ManageCommunityPage /> },
          { path: "communities/invitations", element: <CommunityInvitationsPage /> },
          { path: "join/:code", element: <JoinWithCodePage /> },
          { path: "events/mine", element: <MyEventsPage /> },
          { path: "events/manage/:eventId", element: <ManageEventPage /> },
          { path: "marketplace/orders/:orderId", element: <OrderPage /> },
          { path: "staff", element: <StaffPage /> },
          {
            path: "settings",
            element: <SettingsLayout />,
            children: [
              { index: true, element: <ProfileSettings /> },
              { path: "account", element: <AccountSettings /> },
              { path: "schools", element: <MySchoolsSettings /> },
              { path: "people", element: <PeopleSettings /> },
              { path: "wallet", element: <WalletSettings /> },
              { path: "moderation", element: <SafetySettings /> },
              { path: "privacy", element: <PrivacySettings /> },
              { path: "notifications", element: <NotificationSettings /> },
              { path: "security", element: <SecuritySettings /> },
              { path: "data", element: <DataSettings /> },
            ],
          },
        ],
      },
      { path: "home", element: <Navigate to="/feed" replace /> },
      { element: <MarketingLayout />, children: [{ path: "*", element: <NotFoundPage /> }] },
    ],
  },
];

export const router = createBrowserRouter(routes);
