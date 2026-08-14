/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next"
import { notFound } from "next/navigation"

import {
  Display,
  H1,
  H2,
  H3,
  HeadingLine,
  HeadingAccent,
  HeadingMuted,
  Eyebrow,
  Lead,
  Body,
  BodySm,
  Quote,
  Caption,
} from "@/components/ui/typography"
import { Button } from "@/components/ui/button"
import { PriceTag } from "@/components/ui/price-tag"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu"
import {
  Menubar,
  MenubarCheckboxItem,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarShortcut,
  MenubarTrigger,
} from "@/components/ui/menubar"

import { ToastDemo } from "./toast-demo"

export const metadata: Metadata = {
  title: "Styleguide",
  robots: { index: false, follow: false },
}

function Row({
  name,
  spec,
  children,
}: {
  name: string
  spec: string
  children: React.ReactNode
}) {
  return (
    <div className="grid gap-3 border-t border-border py-10 sm:grid-cols-[10rem_1fr] sm:gap-8">
      <div className="flex flex-col gap-1">
        <Caption>{name}</Caption>
        <BodySm className="text-xs">{spec}</BodySm>
      </div>
      <div>{children}</div>
    </div>
  )
}

function GroupTitle({ children }: { children: React.ReactNode }) {
  return (
    <H3 as="h2" className="mt-20 first:mt-12">
      {children}
    </H3>
  )
}

export default function StyleguidePage() {
  // Dev-only reference — never reachable in production.
  if (process.env.NODE_ENV === "production") notFound()

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-20 sm:py-28">
      <Eyebrow>Design System</Eyebrow>
      <H1 className="mt-4">
        <HeadingLine>Design</HeadingLine>
        <HeadingAccent>system</HeadingAccent>
      </H1>
      <Lead className="mt-5 max-w-xl">
        The Bella Nails primitives — Cormorant Garamond for editorial voice,
        Plus Jakarta Sans for everything functional.
      </Lead>

      <GroupTitle>Logo</GroupTitle>

      <Row name="Primary" spec="wordmark · rule · city">
        <img
          src="/brand/bella-nails-primary.svg"
          alt="Bella Nails primary logo"
          className="h-40 w-auto"
        />
      </Row>

      <Row name="Horizontal" spec="nav · tight spaces">
        <img
          src="/brand/bella-nails-horizontal.svg"
          alt="Bella Nails horizontal logo"
          className="h-16 w-auto"
        />
      </Row>

      <Row name="Monogram" spec="favicon · app · avatar">
        <div className="flex items-end gap-6">
          <img
            src="/brand/bella-nails-monogram.svg"
            alt="Bella Nails monogram"
            className="h-20 w-20"
          />
          <img
            src="/favicon.svg"
            alt="Bella Nails favicon at 32px"
            className="h-8 w-8"
          />
          <img
            src="/favicon.svg"
            alt="Bella Nails favicon at 16px"
            className="h-4 w-4"
          />
        </div>
      </Row>

      <Row name="Reverse" spec="alabaster · on Onyx">
        <div className="flex flex-wrap items-center gap-10 rounded-sm bg-foreground p-10">
          <img
            src="/brand/bella-nails-primary-reverse.svg"
            alt="Bella Nails primary logo, reversed"
            className="h-32 w-auto"
          />
          <img
            src="/brand/bella-nails-monogram-reverse.svg"
            alt="Bella Nails monogram, reversed"
            className="h-16 w-16"
          />
        </div>
      </Row>

      <GroupTitle>Typography</GroupTitle>

      <Row name="Display" spec="editorial · hero · <h1>">
        <Display as="p">Where Craft Becomes Art</Display>
      </Row>

      <Row name="Display" spec="editorial · muted continuation">
        <Display as="p">
          <HeadingLine>The Menu</HeadingLine>
          <HeadingMuted>Treatments &amp; Curation</HeadingMuted>
        </Display>
      </Row>

      <Row name="H1" spec="editorial · roman + italic line">
        <H1 as="p">
          <HeadingLine>A Selection</HeadingLine>
          <HeadingAccent>of the Studio&rsquo;s Best</HeadingAccent>
        </H1>
      </Row>

      <Row name="H2" spec="editorial · section">
        <H2 as="p">
          <HeadingLine>Nails as a medium.</HeadingLine>
          <HeadingAccent>Silence as a luxury.</HeadingAccent>
        </H2>
      </Row>

      <Row name="H3" spec="editorial · titles">
        <H3 as="p">Classic Gel Extension</H3>
      </Row>

      <Row name="Eyebrow" spec="functional · uppercase · wide">
        <Eyebrow>Most Requested</Eyebrow>
      </Row>

      <Row name="Lead" spec="functional · intro">
        <Lead>
          The Curation Studio is a private atelier in the heart of Copenhagen.
        </Lead>
      </Row>

      <Row name="Body" spec="functional · running text">
        <Body>
          We operate by appointment only — no walk-ins, no noise, no compromise.
          Each session is a study in precision and restraint.
        </Body>
      </Row>

      <Row name="Body / small" spec="functional · muted">
        <BodySm>
          By appointment only. The studio is never shared between clients.
        </BodySm>
      </Row>

      <Row name="Quote" spec="editorial · italic">
        <Quote>
          &ldquo;The most considered nail experience I have ever had. The
          silence alone is worth the price.&rdquo;
        </Quote>
      </Row>

      <Row name="Caption" spec="functional · attribution">
        <Caption>Ashley H. · Architect, Copenhagen</Caption>
      </Row>

      <GroupTitle>Buttons</GroupTitle>

      <Row name="Button" spec="variants">
        <div className="flex flex-wrap items-center gap-3">
          <Button>Reserve session</Button>
          <Button variant="outline">View menu</Button>
          <Button variant="ghost">Cancel</Button>
          <Button variant="link">Back to selection</Button>
        </div>
      </Row>

      <Row name="Button" spec="inverse · on dark">
        <div className="flex flex-wrap items-center gap-3 rounded-sm bg-foreground p-6">
          <Button variant="inverse">Reserve your session</Button>
        </div>
      </Row>

      <Row name="Button" spec="sizes">
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm">Small</Button>
          <Button size="default">Default</Button>
          <Button size="lg">Large</Button>
        </div>
      </Row>

      <Row name="Button" spec="disabled">
        <Button disabled>Reserve session</Button>
      </Row>

      <GroupTitle>Prices</GroupTitle>

      <Row name="PriceTag" spec="base · add-on · total">
        <div className="flex flex-wrap items-baseline gap-8">
          <PriceTag cents={65000} className="text-xl" />
          <PriceTag cents={5000} sign className="text-xl" />
          <PriceTag cents={82000} className="text-3xl" />
        </div>
      </Row>

      <GroupTitle>Forms</GroupTitle>

      <Row name="Input" spec="label + underline field">
        <div className="flex max-w-sm flex-col gap-2">
          <Label htmlFor="sg-name">Full name</Label>
          <Input id="sg-name" placeholder="E.g. Raul Octavian" />
        </div>
      </Row>

      <Row name="Textarea" spec="session notes">
        <div className="flex max-w-sm flex-col gap-2">
          <Label htmlFor="sg-notes">Session notes (optional)</Label>
          <Textarea id="sg-notes" placeholder="Anything we should know?" />
        </div>
      </Row>

      <Row name="Checkbox" spec="add-on row">
        <label className="flex max-w-sm items-center justify-between gap-4">
          <span className="flex items-center gap-3">
            <Checkbox defaultChecked />
            <Body>French tips</Body>
          </span>
          <PriceTag cents={5000} sign />
        </label>
      </Row>

      <Row name="Separator" spec="hairline divider">
        <div className="max-w-sm">
          <Body>Classic Gel Extension</Body>
          <Separator className="my-4" />
          <BodySm>90 min · private session</BodySm>
        </div>
      </Row>

      <GroupTitle>Menus</GroupTitle>

      <Row name="DropdownMenu" spec="account · language · click-triggered">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="outline">Account</Button>}
          />
          <DropdownMenuContent align="start">
            <DropdownMenuLabel>Signed in as Ashley</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>My bookings</DropdownMenuItem>
            <DropdownMenuItem>Account settings</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive">Sign out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </Row>

      <Row name="NavigationMenu" spec="site nav · hover panel">
        <NavigationMenu>
          <NavigationMenuList>
            <NavigationMenuItem>
              <NavigationMenuTrigger>Services</NavigationMenuTrigger>
              <NavigationMenuContent>
                <ul className="grid w-64 gap-1">
                  <li>
                    <NavigationMenuLink href="#">
                      Classic Gel Extension
                    </NavigationMenuLink>
                  </li>
                  <li>
                    <NavigationMenuLink href="#">
                      The Atelier Edit
                    </NavigationMenuLink>
                  </li>
                  <li>
                    <NavigationMenuLink href="#">
                      Nail Art &amp; Detailing
                    </NavigationMenuLink>
                  </li>
                </ul>
              </NavigationMenuContent>
            </NavigationMenuItem>
            <NavigationMenuItem>
              <NavigationMenuLink href="#">Gallery</NavigationMenuLink>
            </NavigationMenuItem>
            <NavigationMenuItem>
              <NavigationMenuLink href="#">About</NavigationMenuLink>
            </NavigationMenuItem>
          </NavigationMenuList>
        </NavigationMenu>
      </Row>

      <Row name="Menubar" spec="admin · persistent command bar">
        <Menubar>
          <MenubarMenu>
            <MenubarTrigger>Booking</MenubarTrigger>
            <MenubarContent>
              <MenubarItem>
                New appointment <MenubarShortcut>⌘N</MenubarShortcut>
              </MenubarItem>
              <MenubarItem>
                Find client <MenubarShortcut>⌘F</MenubarShortcut>
              </MenubarItem>
              <MenubarSeparator />
              <MenubarItem variant="destructive">Cancel booking</MenubarItem>
            </MenubarContent>
          </MenubarMenu>
          <MenubarMenu>
            <MenubarTrigger>View</MenubarTrigger>
            <MenubarContent>
              <MenubarCheckboxItem defaultChecked>
                Show past bookings
              </MenubarCheckboxItem>
              <MenubarCheckboxItem>Compact rows</MenubarCheckboxItem>
            </MenubarContent>
          </MenubarMenu>
        </Menubar>
      </Row>

      <GroupTitle>Feedback</GroupTitle>

      <Row name="Toast" spec="sonner · booking feedback">
        <ToastDemo />
      </Row>
    </main>
  )
}
