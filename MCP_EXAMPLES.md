# MCP UI Libraries - Examples

Real examples of how the AI uses MCP to generate modern, animated websites.

## 🎬 Example 1: Modern SaaS Landing Page

**User Prompt:**
```
Create a modern SaaS landing page with smooth animations
```

**MCP Process:**

1. **Keywords extracted:** `modern`, `animation`, `landing`

2. **MCP searches and finds:**
   - FadeIn (Framer Motion)
   - SlideIn (Framer Motion)
   - ShimmerButton (Magic UI)
   - Card (Shadcn UI)

3. **Context added to AI prompt:**
   ```
   🎨 AVAILABLE COMPONENTS:
   - FadeIn: Smooth fade-in animation
   - SlideIn: Slide from any direction
   - ShimmerButton: Button with shimmer effect
   - Card: Flexible card component
   ```

4. **AI generates:**

```tsx
// app/page.tsx
'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';

function FadeIn({ children, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
    >
      {children}
    </motion.div>
  );
}

function ShimmerButton({ children, href }: { children: React.ReactNode; href: string }) {
  return (
    <Link href={href}>
      <motion.button
        className="relative overflow-hidden rounded-lg bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 px-8 py-4 text-white font-bold text-lg"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
          initial={{ x: '-100%' }}
          animate={{ x: '100%' }}
          transition={{
            repeat: Infinity,
            duration: 1.5,
            ease: "linear"
          }}
        />
        <span className="relative z-10">{children}</span>
      </motion.button>
    </Link>
  );
}

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <FadeIn>
          <h1 className="text-6xl font-bold text-white mb-6">
            Transform Your Workflow
          </h1>
        </FadeIn>

        <FadeIn delay={0.2}>
          <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
            Streamline your business processes with our cutting-edge SaaS platform.
            Boost productivity by 10x with AI-powered automation.
          </p>
        </FadeIn>

        <FadeIn delay={0.4}>
          <div className="flex gap-4 justify-center">
            <ShimmerButton href="/signup">Get Started Free</ShimmerButton>
            <motion.a
              href="/demo"
              className="px-8 py-4 rounded-lg border-2 border-white text-white font-bold text-lg"
              whileHover={{ scale: 1.05 }}
            >
              Watch Demo
            </motion.a>
          </div>
        </FadeIn>
      </section>

      {/* Features */}
      <section className="container mx-auto px-4 py-20">
        <FadeIn delay={0.6}>
          <h2 className="text-4xl font-bold text-white text-center mb-12">
            Powerful Features
          </h2>
        </FadeIn>

        <motion.div
          className="grid md:grid-cols-3 gap-8"
          initial="hidden"
          animate="visible"
          variants={{
            hidden: { opacity: 0 },
            visible: {
              opacity: 1,
              transition: { staggerChildren: 0.2 }
            }
          }}
        >
          {[
            { title: "AI-Powered", description: "Leverage cutting-edge AI technology" },
            { title: "Real-time Sync", description: "Collaborate seamlessly across teams" },
            { title: "Analytics", description: "Deep insights into your data" }
          ].map((feature, idx) => (
            <motion.div
              key={idx}
              className="bg-white/10 backdrop-blur-lg rounded-xl p-8 border border-white/20"
              variants={{
                hidden: { opacity: 0, y: 20 },
                visible: { opacity: 1, y: 0 }
              }}
              whileHover={{ scale: 1.05, borderColor: 'rgba(255,255,255,0.5)' }}
            >
              <h3 className="text-2xl font-bold text-white mb-4">{feature.title}</h3>
              <p className="text-gray-300">{feature.description}</p>
            </motion.div>
          ))}
        </motion.div>
      </section>
    </div>
  );
}
```

**Generated package.json:**
```json
{
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "framer-motion": "^11.0.0"
  }
}
```

## 🎨 Example 2: Portfolio with Parallax

**User Prompt:**
```
Create a photographer portfolio with parallax scrolling effects
```

**MCP finds:**
- ParallaxScroll (Framer Motion)
- FadeIn (Framer Motion)
- BentoGrid (Aceternity UI)

**Generated code includes:**

```tsx
'use client';

import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef } from 'react';

function ParallaxImage({ src, alt, speed = 0.5 }) {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"]
  });

  const y = useTransform(scrollYProgress, [0, 1], [0, speed * 100]);

  return (
    <div ref={ref} className="overflow-hidden">
      <motion.img
        src={src}
        alt={alt}
        style={{ y }}
        className="w-full h-auto"
      />
    </div>
  );
}

export default function PortfolioPage() {
  return (
    <div>
      <section className="min-h-screen relative">
        <ParallaxImage
          src="https://images.unsplash.com/photo-1..."
          alt="Hero photograph"
          speed={-0.5}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <h1 className="text-6xl font-bold text-white">John Doe Photography</h1>
        </div>
      </section>

      <section className="container mx-auto px-4 py-20">
        <div className="grid md:grid-cols-2 gap-8">
          <ParallaxImage
            src="https://images.unsplash.com/photo-2..."
            alt="Portfolio image 1"
            speed={0.3}
          />
          <ParallaxImage
            src="https://images.unsplash.com/photo-3..."
            alt="Portfolio image 2"
            speed={-0.3}
          />
        </div>
      </section>
    </div>
  );
}
```

## 🌟 Example 3: E-commerce with Animations

**User Prompt:**
```
Create an e-commerce product page with smooth hover effects and animations
```

**MCP finds:**
- ScaleIn (Framer Motion)
- Card (Shadcn UI)
- ShimmerButton (Magic UI)

**Generated code:**

```tsx
'use client';

import { motion } from 'framer-motion';

function ProductCard({ product }) {
  return (
    <motion.div
      className="bg-white rounded-xl shadow-lg overflow-hidden cursor-pointer"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{
        scale: 1.05,
        boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)"
      }}
      transition={{ duration: 0.3 }}
    >
      <motion.img
        src={product.image}
        alt={product.name}
        className="w-full h-64 object-cover"
        whileHover={{ scale: 1.1 }}
        transition={{ duration: 0.3 }}
      />
      <div className="p-6">
        <h3 className="text-xl font-bold mb-2">{product.name}</h3>
        <p className="text-gray-600 mb-4">{product.description}</p>
        <div className="flex justify-between items-center">
          <span className="text-2xl font-bold">${product.price}</span>
          <motion.button
            className="bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            Add to Cart
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}

export default function ProductsPage() {
  const products = [
    { id: 1, name: "Premium Headphones", price: 299, image: "...", description: "High-fidelity audio" },
    { id: 2, name: "Smart Watch", price: 399, image: "...", description: "Track your fitness" },
    { id: 3, name: "Wireless Earbuds", price: 199, image: "...", description: "Crystal clear sound" },
  ];

  return (
    <div className="container mx-auto px-4 py-20">
      <motion.h1
        className="text-5xl font-bold text-center mb-12"
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
      >
        Our Products
      </motion.h1>

      <motion.div
        className="grid md:grid-cols-3 gap-8"
        initial="hidden"
        animate="visible"
        variants={{
          hidden: { opacity: 0 },
          visible: {
            opacity: 1,
            transition: { staggerChildren: 0.2 }
          }
        }}
      >
        {products.map((product) => (
          <motion.div
            key={product.id}
            variants={{
              hidden: { opacity: 0, y: 50 },
              visible: { opacity: 1, y: 0 }
            }}
          >
            <ProductCard product={product} />
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
```

## 🎯 Key Takeaways

1. **Automatic Component Discovery**: AI finds relevant components based on prompt keywords
2. **Complete Code Generation**: Full, working code with proper imports
3. **Dependencies Auto-Added**: No manual package.json editing needed
4. **Best Practices**: Generated code follows modern React patterns
5. **Customizable**: Users can edit and extend the generated components

## 🔄 How to Extend

Add your own components to `mcp/ui-libraries-server.ts`:

```typescript
const UI_LIBRARIES = {
  myCustomLib: {
    name: "My Custom Library",
    package: "my-custom-lib",
    description: "My amazing components",
    components: [
      {
        name: "AwesomeComponent",
        description: "Does something awesome",
        installation: "npm install my-custom-lib",
        dependencies: { "my-custom-lib": "^1.0.0" },
        usage: `import { AwesomeComponent } from 'my-custom-lib';

export function MyComponent() {
  return <AwesomeComponent>Hello</AwesomeComponent>;
}`,
        examples: ['<AwesomeComponent>Example</AwesomeComponent>']
      }
    ]
  }
};
```

Then the AI will automatically use it when relevant!
