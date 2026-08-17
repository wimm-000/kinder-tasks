import { Form, useSubmit } from "react-router";

import { Button } from "~/components/ui/button";
import { clearOfflineData } from "~/lib/offline/database";

export function ClearOfflineSubmit({ csrf, label }: { csrf: string; label: string }) {
  const submit = useSubmit();
  return (
    <Form
      method="post"
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        sessionStorage.removeItem("kinder-offline-active-key");
        void clearOfflineData().then(() => submit(form, { method: "post" }));
      }}
    >
      <input type="hidden" name="_csrf" value={csrf} />
      <input type="hidden" name="intent" value="leave" />
      <Button className="w-full" type="submit" variant="outline">
        {label}
      </Button>
    </Form>
  );
}
