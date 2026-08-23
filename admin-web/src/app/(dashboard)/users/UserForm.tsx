"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import { ROLE_LABELS } from "@/lib/roleLabels";

type Role = { id: string; name: string };

export default function UserForm({ roles }: { roles: Role[] }) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [employeeCode, setEmployeeCode] = useState("");
  const [isFieldAgent, setIsFieldAgent] = useState(false);
  const [password, setPassword] = useState("");
  const [roleId, setRoleId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const userResponse = await fetch("/api/proxy/users", {
        method: "POST",
        body: JSON.stringify({
          username,
          first_name: firstName,
          last_name: lastName,
          phone,
          employee_code: employeeCode || null,
          is_field_agent: isFieldAgent,
          password,
        }),
      });
      const userData = await userResponse.json().catch(() => ({}));
      if (!userResponse.ok) throw new Error(JSON.stringify(userData));

      if (roleId) {
        const roleResponse = await fetch("/api/proxy/user-roles", {
          method: "POST",
          body: JSON.stringify({ user: userData.id, role: roleId }),
        });
        if (!roleResponse.ok) throw new Error(JSON.stringify(await roleResponse.json().catch(() => ({}))));
      }

      setUsername("");
      setFirstName("");
      setLastName("");
      setPhone("");
      setEmployeeCode("");
      setIsFieldAgent(false);
      setPassword("");
      setRoleId("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create user.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-wrap items-end gap-3 rounded-lg border border-dashed border-neutral-300 dark:border-neutral-700 p-4"
    >
      <div>
        <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400">Username / email</label>
        <input
          required
          type="email"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="mt-1 w-56 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 px-2 py-1.5 text-sm text-neutral-900 dark:text-neutral-100"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400">First name</label>
        <input
          required
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          className="mt-1 w-36 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 px-2 py-1.5 text-sm text-neutral-900 dark:text-neutral-100"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400">Last name</label>
        <input
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          className="mt-1 w-36 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 px-2 py-1.5 text-sm text-neutral-900 dark:text-neutral-100"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400">Phone</label>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="mt-1 w-32 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 px-2 py-1.5 text-sm text-neutral-900 dark:text-neutral-100"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400">Employee code</label>
        <input
          value={employeeCode}
          onChange={(e) => setEmployeeCode(e.target.value)}
          className="mt-1 w-28 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 px-2 py-1.5 text-sm text-neutral-900 dark:text-neutral-100"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400">Initial password</label>
        <input
          required
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-36 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 px-2 py-1.5 text-sm text-neutral-900 dark:text-neutral-100"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400">Role</label>
        <select
          value={roleId}
          onChange={(e) => setRoleId(e.target.value)}
          className="mt-1 w-56 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 px-2 py-1.5 text-sm text-neutral-900 dark:text-neutral-100"
        >
          <option value="">No role yet</option>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {ROLE_LABELS[r.name] || r.name}
            </option>
          ))}
        </select>
      </div>
      <label className="flex items-center gap-1.5 pb-1.5 text-xs font-medium text-neutral-600 dark:text-neutral-400">
        <input type="checkbox" checked={isFieldAgent} onChange={(e) => setIsFieldAgent(e.target.checked)} />
        Field agent
      </label>
      <Button
        type="submit"
        disabled={submitting}>
        {submitting ? "Adding…" : "Add User"}
      </Button>
      {error && <p className="w-full text-xs text-red-600">{error}</p>}
    </form>
  );
}
