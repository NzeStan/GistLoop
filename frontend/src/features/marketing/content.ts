import { CalendarDays, EyeOff, type LucideIcon, Mic, Newspaper, ShoppingBag, Users } from "lucide-react";

import { brand } from "@/config/brand";

export interface Feature {
  key: keyof typeof brand.assets.features;
  icon: LucideIcon;
  title: string;
  summary: string;
  points: string[];
  to: string;
}

export const FEATURES: Feature[] = [
  {
    key: "feed",
    icon: Newspaper,
    title: "A feed worth scrolling",
    summary: "Follow friends, classmates and creators. See what's trending on campus right now, not last week.",
    points: ["Following, latest and trending feeds", "Polls, hashtags and mentions", "Choose who sees every post"],
    to: "/features#feed",
  },
  {
    key: "communities",
    icon: Users,
    title: "Communities for everything",
    summary: "Departments, hostels, clubs, faith groups and fandoms, each with its own space and moderators.",
    points: ["Public, approval-only or private", "Community rules and moderators", "Posts for members only"],
    to: "/features#communities",
  },
  {
    key: "gist",
    icon: EyeOff,
    title: "Anonymous gist, done safely",
    summary:
      "Ask the awkward question or share the confession without your name on it, inside the communities you belong to.",
    points: ["No one sees who posted", "Members-only boards", "Reported abuse is still moderated"],
    to: "/features#gist",
  },
  {
    key: "events",
    icon: CalendarDays,
    title: "Events you'll actually hear about",
    summary: "From lectures to hackathons to owambe: RSVP in a tap, join waitlists and add events to your calendar.",
    points: ["Free and ticketed events", "Waitlists and reminders", "Online, in person or hybrid"],
    to: "/features#events",
  },
  {
    key: "marketplace",
    icon: ShoppingBag,
    title: "A marketplace you can trust",
    summary: "Buy and sell textbooks, gadgets and services with students near you, with payments held in escrow.",
    points: ["Escrow-protected payments", "Seller ratings and reviews", "Pickup or delivery"],
    to: "/features#marketplace",
  },
  {
    key: "podcasts",
    icon: Mic,
    title: "Podcasts from your people",
    summary: "Listen to shows made on campus, or start your own with episodes, transcripts and an RSS feed.",
    points: ["Stream episodes anywhere", "Transcripts for accessibility", "Works with podcast apps"],
    to: "/features#podcasts",
  },
];

export const FAQ = [
  {
    q: `Is ${brand.name} free?`,
    a: `Yes. Joining and using ${brand.name} is free. Some events may sell tickets and marketplace sellers set their own prices.`,
  },
  {
    q: "Who can join?",
    a: "Anyone aged 16 or over. Students can verify their institution to unlock campus-only communities and events.",
  },
  {
    q: "How anonymous is anonymous gist?",
    a: "Other members, community moderators and even most of our staff can't see who wrote a gist. Identities are encrypted and can only be revealed through a strict two-person process for serious legal or safety reasons, such as threats of violence.",
  },
  {
    q: "How do you keep people safe?",
    a: "Reporting on every post, trained moderators, account restrictions for repeat offenders, privacy controls you set, and rate limits that stop spam and harassment at scale.",
  },
  {
    q: "What happens to my data?",
    a: "You own it. Download a copy any time from Settings, and delete your account whenever you like. We never sell your personal data.",
  },
  {
    q: "How do marketplace payments work?",
    a: "When you pay online, the money is held in escrow and only released to the seller after you confirm you've received the item. If something goes wrong, you can open a dispute.",
  },
  {
    q: "Can my school or organisation partner with you?",
    a: "Yes! We work with institutions, student unions and brands. Reach us through the contact page and choose “Partnerships”.",
  },
];

export const TESTIMONIALS = [
  {
    quote: "I found my project team, my hostel's group and a second-hand laptop in the same week.",
    name: "Adaeze, 300L Computer Science",
  },
  {
    quote: "Our club's events went from 20 people to a full hall. The RSVPs and reminders just work.",
    name: "Kunle, Events Lead, Debate Society",
  },
  {
    quote: "The anonymous board is where the real questions get asked, and the moderation keeps it kind.",
    name: "Fatima, 200L Medicine",
  },
];
