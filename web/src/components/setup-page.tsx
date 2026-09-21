export default function SetupPage({ databaseError }: { databaseError?: string }) {
  return (
    <main className="setup-shell">
      <section className="setup-card">
        <p className="eyebrow">ACCOUNT SETUP</p>
        <h1>Connect Supabase to continue.</h1>
        <p className="setup-copy">
          The application code is ready, but it needs your own Supabase project
          before accounts and saved holdings can work.
        </p>

        {databaseError && (
          <div className="setup-warning">
            <strong>The app connected, but the positions table is unavailable.</strong>
            <p>{databaseError}</p>
          </div>
        )}

        <ol className="setup-steps">
          <li>
            <strong>Create a Supabase project.</strong>
            <span>Use the Supabase dashboard and wait for the database to finish starting.</span>
          </li>
          <li>
            <strong>Run the migration.</strong>
            <span>
              In Supabase SQL Editor, run the contents of
              <code> supabase/migrations/202609190001_create_positions.sql</code>.
            </span>
          </li>
          <li>
            <strong>Create your local environment file.</strong>
            <span>
              From <code>web/</code>, copy <code>.env.example</code> to
              <code> .env.local</code>.
            </span>
          </li>
          <li>
            <strong>Add the project URL and publishable key.</strong>
            <span>Find both values in Supabase project settings, then restart npm run dev.</span>
          </li>
        </ol>

        <div className="setup-command">
          <code>cp .env.example .env.local</code>
        </div>
        <p className="auth-note">
          Do not put a service_role key in the browser environment file.
        </p>
      </section>
    </main>
  );
}
