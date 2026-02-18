/**
 * Examples of using the Loading component
 *
 * This file demonstrates various use cases for the Loading component.
 * You can delete this file - it's just for reference.
 */

import Loading from "./Loading";

// Example 1: Basic loading spinner (default size)
export function Example1() {
  return <Loading />;
}

// Example 2: Small spinner with text
export function Example2() {
  return <Loading size="sm" text="Loading..." />;
}

// Example 3: Large spinner with custom text
export function Example3() {
  return <Loading size="lg" text="Please wait while we process your request" />;
}

// Example 4: Full screen loading overlay
export function Example4() {
  return <Loading fullScreen text="Loading your application..." />;
}

// Example 5: Loading state in a component
export function Example5() {
  const isLoading = true;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loading text="Fetching data..." />
      </div>
    );
  }

  return <div>Your content here</div>;
}

// Example 6: Conditional full screen loading
export function Example6() {
  const isLoading = true;

  return (
    <div>
      {isLoading && <Loading fullScreen text="Initializing..." />}
      <div>Your main content</div>
    </div>
  );
}

// Example 7: Custom styled loading with className
export function Example7() {
  return (
    <div className="p-8 bg-gray-100 rounded-lg">
      <Loading className="py-12" text="Processing..." />
    </div>
  );
}

// Example 8: Use in Server Components (loading.tsx file)
// Create a file at: app/loading.tsx
/*
import Loading from "@/app/components/Loading";

export default function LoadingPage() {
  return <Loading fullScreen text="Loading..." />;
}
*/

// Example 9: Use in API route handlers or server actions
/*
import Loading from "@/app/components/Loading";

export default async function Page() {
  // This will show while server component is loading
  return (
    <div className="container mx-auto py-8">
      <Loading text="Loading page data..." />
    </div>
  );
}
*/

// Example 10: Loading state for button/inline use
export function Example10() {
  const [isSubmitting, setIsSubmitting] = useState(false);

  return (
    <button
      onClick={() => setIsSubmitting(true)}
      disabled={isSubmitting}
      className="px-4 py-2 bg-blue-500 text-white rounded-lg disabled:opacity-50"
    >
      {isSubmitting ? (
        <span className="flex items-center gap-2">
          <Loading size="sm" />
          Submitting...
        </span>
      ) : (
        "Submit"
      )}
    </button>
  );
}
