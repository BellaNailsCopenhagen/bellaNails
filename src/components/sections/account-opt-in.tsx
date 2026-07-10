"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { Checkbox } from "@/components/ui/checkbox";
import { BodySm } from "@/components/ui/typography";

/**
 * AccountOptIn — "create an account to manage this booking" toggle on the
 * confirm step. UI-only passthrough for now; the Clerk profile write hangs
 * off it in the webhook/identity flow. Rendered only for signed-out
 * visitors (the caller wraps it in <SignedOut>).
 */
export function AccountOptIn() {
  const t = useTranslations("booking");
  const [wantsAccount, setWantsAccount] = React.useState(false);

  return (
    <label className="flex w-full cursor-pointer items-center gap-4">
      <Checkbox
        checked={wantsAccount}
        onCheckedChange={(checked) => setWantsAccount(checked === true)}
      />
      <BodySm as="span">{t("accountOptIn")}</BodySm>
    </label>
  );
}
