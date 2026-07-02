import { useState, FormEvent } from "react";
import { Link } from "react-router-dom";
import { useMutation } from "@apollo/client";
import { REQUEST_PASSWORD_RESET_MUTATION } from "../lib/graphql";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [requestReset, { loading }] = useMutation(REQUEST_PASSWORD_RESET_MUTATION);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await requestReset({ variables: { email } });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-primary-700">ShiftFlow</h1>
          <p className="mt-2 text-gray-600">Reset your password</p>
        </div>

        {sent ? (
          <div className="rounded-lg bg-white p-8 shadow text-center">
            <p className="text-green-700">
              If an account with that email exists, a reset link has been sent.
            </p>
            <Link to="/login" className="mt-4 inline-block text-primary-600 hover:text-primary-500">
              Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6 rounded-lg bg-white p-8 shadow">
            {error && (
              <div className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</div>
            )}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-primary-600 px-4 py-2 text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {loading ? "Sending..." : "Send reset link"}
            </button>
            <p className="text-center text-sm">
              <Link to="/login" className="text-primary-600 hover:text-primary-500">
                Back to sign in
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
