#!/usr/bin/env node

/**
 * MCP Server for Modern UI Libraries
 * Provides access to Framer Motion, Shadcn/ui, Aceternity UI, Magic UI, etc.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import {
  fetchNpmPackage,
  searchNpm,
  discoverComponents,
  fetchLatestVersions,
  getCacheStats,
} from "./npm-fetcher.js";

// ============================================================================
// UI LIBRARY CATALOG
// ============================================================================

interface ComponentInfo {
  name: string;
  library: string;
  description: string;
  installation: string;
  dependencies: Record<string, string>;
  usage: string;
  props?: string;
  examples: string[];
}

const UI_LIBRARIES = {
  framerMotion: {
    name: "Framer Motion",
    package: "framer-motion",
    version: "^11.0.0",
    description: "Production-ready motion library for React",
    components: [
      {
        name: "FadeIn",
        description: "Smooth fade-in animation component",
        installation: "npm install framer-motion",
        dependencies: { "framer-motion": "^11.0.0" },
        usage: `import { motion } from 'framer-motion';

export function FadeIn({ children, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
    >
      {children}
    </motion.div>
  );
}`,
        examples: [
          '<FadeIn><h1>Hello World</h1></FadeIn>',
          '<FadeIn delay={0.2}><p>Delayed fade in</p></FadeIn>'
        ]
      },
      {
        name: "SlideIn",
        description: "Slide-in animation from any direction",
        installation: "npm install framer-motion",
        dependencies: { "framer-motion": "^11.0.0" },
        usage: `import { motion } from 'framer-motion';

export function SlideIn({ children, direction = 'left', delay = 0 }) {
  const directions = {
    left: { x: -100, y: 0 },
    right: { x: 100, y: 0 },
    up: { x: 0, y: -100 },
    down: { x: 0, y: 100 }
  };

  return (
    <motion.div
      initial={{ opacity: 0, ...directions[direction] }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      transition={{ duration: 0.6, delay }}
    >
      {children}
    </motion.div>
  );
}`,
        examples: [
          '<SlideIn direction="left"><Card>Content</Card></SlideIn>',
          '<SlideIn direction="up" delay={0.3}><div>Slide up</div></SlideIn>'
        ]
      },
      {
        name: "ScaleIn",
        description: "Scale-in animation with bounce effect",
        installation: "npm install framer-motion",
        dependencies: { "framer-motion": "^11.0.0" },
        usage: `import { motion } from 'framer-motion';

export function ScaleIn({ children, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{
        duration: 0.5,
        delay,
        type: "spring",
        stiffness: 100
      }}
    >
      {children}
    </motion.div>
  );
}`,
        examples: [
          '<ScaleIn><button>Animated Button</button></ScaleIn>',
          '<ScaleIn delay={0.1}><img src="..." alt="..." /></ScaleIn>'
        ]
      },
      {
        name: "ParallaxScroll",
        description: "Parallax scrolling effect",
        installation: "npm install framer-motion",
        dependencies: { "framer-motion": "^11.0.0" },
        usage: `import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef } from 'react';

export function ParallaxScroll({ children, speed = 0.5 }) {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"]
  });

  const y = useTransform(scrollYProgress, [0, 1], [0, speed * 100]);

  return (
    <motion.div ref={ref} style={{ y }}>
      {children}
    </motion.div>
  );
}`,
        examples: [
          '<ParallaxScroll speed={0.5}><img src="..." /></ParallaxScroll>',
          '<ParallaxScroll speed={-0.3}><div>Reverse parallax</div></ParallaxScroll>'
        ]
      },
      {
        name: "StaggerChildren",
        description: "Stagger animation for child elements",
        installation: "npm install framer-motion",
        dependencies: { "framer-motion": "^11.0.0" },
        usage: `import { motion } from 'framer-motion';

export function StaggerChildren({ children }) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: {
            staggerChildren: 0.1
          }
        }
      }}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children }) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0 }
      }}
    >
      {children}
    </motion.div>
  );
}`,
        examples: [
          '<StaggerChildren>{items.map(item => <StaggerItem key={item.id}><Card>{item}</Card></StaggerItem>)}</StaggerChildren>'
        ]
      }
    ]
  },

  shadcnUI: {
    name: "Shadcn UI",
    package: "@radix-ui/react-*",
    description: "Beautiful, accessible components built with Radix UI and Tailwind",
    components: [
      {
        name: "Button",
        description: "Accessible button component with variants",
        installation: "npx shadcn-ui@latest add button",
        dependencies: {
          "@radix-ui/react-slot": "^1.0.2",
          "class-variance-authority": "^0.7.0",
          "clsx": "^2.0.0",
          "tailwind-merge": "^2.0.0"
        },
        usage: `import { cn } from '@/lib/utils';

const buttonVariants = {
  variant: {
    default: "bg-primary text-primary-foreground hover:bg-primary/90",
    destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
    outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
    secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
    ghost: "hover:bg-accent hover:text-accent-foreground",
    link: "text-primary underline-offset-4 hover:underline"
  },
  size: {
    default: "h-10 px-4 py-2",
    sm: "h-9 rounded-md px-3",
    lg: "h-11 rounded-md px-8",
    icon: "h-10 w-10"
  }
};

export function Button({ className, variant = 'default', size = 'default', ...props }) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
        buttonVariants.variant[variant],
        buttonVariants.size[size],
        className
      )}
      {...props}
    />
  );
}`,
        examples: [
          '<Button>Click me</Button>',
          '<Button variant="outline">Outline</Button>',
          '<Button size="lg">Large Button</Button>'
        ]
      },
      {
        name: "Card",
        description: "Flexible card component for content containers",
        installation: "npx shadcn-ui@latest add card",
        dependencies: {
          "clsx": "^2.0.0",
          "tailwind-merge": "^2.0.0"
        },
        usage: `import { cn } from '@/lib/utils';

export function Card({ className, ...props }) {
  return (
    <div
      className={cn("rounded-lg border bg-card text-card-foreground shadow-sm", className)}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }) {
  return <div className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />;
}

export function CardTitle({ className, ...props }) {
  return <h3 className={cn("text-2xl font-semibold leading-none tracking-tight", className)} {...props} />;
}

export function CardDescription({ className, ...props }) {
  return <p className={cn("text-sm text-muted-foreground", className)} {...props} />;
}

export function CardContent({ className, ...props }) {
  return <div className={cn("p-6 pt-0", className)} {...props} />;
}

export function CardFooter({ className, ...props }) {
  return <div className={cn("flex items-center p-6 pt-0", className)} {...props} />;
}`,
        examples: [
          '<Card><CardHeader><CardTitle>Title</CardTitle><CardDescription>Description</CardDescription></CardHeader><CardContent>Content</CardContent></Card>'
        ]
      }
    ]
  },

  aceternity: {
    name: "Aceternity UI",
    package: "@aceternity/ui",
    description: "Modern, animated UI components",
    components: [
      {
        name: "BentoGrid",
        description: "Responsive bento-style grid layout",
        installation: "Copy from Aceternity UI",
        dependencies: {
          "framer-motion": "^11.0.0",
          "clsx": "^2.0.0"
        },
        usage: `import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

export function BentoGrid({ className, children }) {
  return (
    <div className={cn("grid grid-cols-1 md:grid-cols-3 gap-4 max-w-7xl mx-auto", className)}>
      {children}
    </div>
  );
}

export function BentoGridItem({ className, title, description, header, icon }) {
  return (
    <motion.div
      className={cn(
        "row-span-1 rounded-xl group/bento hover:shadow-xl transition duration-200 shadow-input dark:shadow-none p-4 dark:bg-black dark:border-white/[0.2] bg-white border border-transparent justify-between flex flex-col space-y-4",
        className
      )}
      whileHover={{ scale: 1.02 }}
    >
      {header}
      <div className="group-hover/bento:translate-x-2 transition duration-200">
        {icon}
        <div className="font-sans font-bold text-neutral-600 dark:text-neutral-200 mb-2 mt-2">
          {title}
        </div>
        <div className="font-sans font-normal text-neutral-600 text-xs dark:text-neutral-300">
          {description}
        </div>
      </div>
    </motion.div>
  );
}`,
        examples: [
          '<BentoGrid><BentoGridItem title="Title" description="Description" /></BentoGrid>'
        ]
      },
      {
        name: "TextGenerateEffect",
        description: "Animated text generation effect",
        installation: "Copy from Aceternity UI",
        dependencies: {
          "framer-motion": "^11.0.0"
        },
        usage: `import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export function TextGenerateEffect({ words, className }) {
  const [displayedWords, setDisplayedWords] = useState([]);

  useEffect(() => {
    const wordsArray = words.split(' ');
    let currentIndex = 0;

    const interval = setInterval(() => {
      if (currentIndex < wordsArray.length) {
        setDisplayedWords(prev => [...prev, wordsArray[currentIndex]]);
        currentIndex++;
      } else {
        clearInterval(interval);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [words]);

  return (
    <div className={className}>
      {displayedWords.map((word, idx) => (
        <motion.span
          key={idx}
          initial={{ opacity: 0, filter: "blur(10px)" }}
          animate={{ opacity: 1, filter: "blur(0px)" }}
          transition={{ duration: 0.5 }}
          className="inline-block mr-1"
        >
          {word}
        </motion.span>
      ))}
    </div>
  );
}`,
        examples: [
          '<TextGenerateEffect words="Welcome to the future of web design" />'
        ]
      }
    ]
  },

  magicUI: {
    name: "Magic UI",
    package: "magic-ui",
    description: "Magical animated components",
    components: [
      {
        name: "ShimmerButton",
        description: "Button with shimmer animation effect",
        installation: "Copy from Magic UI",
        dependencies: {
          "framer-motion": "^11.0.0"
        },
        usage: `import { motion } from 'framer-motion';

export function ShimmerButton({ children, className }) {
  return (
    <motion.button
      className={\`relative overflow-hidden rounded-lg bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 px-6 py-3 text-white font-semibold \${className}\`}
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
  );
}`,
        examples: [
          '<ShimmerButton>Get Started</ShimmerButton>'
        ]
      },
      {
        name: "GradientText",
        description: "Animated gradient text effect",
        installation: "Copy from Magic UI",
        dependencies: {},
        usage: `export function GradientText({ children, className }) {
  return (
    <span className={\`bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent animate-gradient \${className}\`}>
      {children}
    </span>
  );
}

// Add to globals.css:
@keyframes gradient {
  0%, 100% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
}

.animate-gradient {
  background-size: 200% 200%;
  animation: gradient 3s ease infinite;
}`,
        examples: [
          '<h1><GradientText>Amazing Headline</GradientText></h1>'
        ]
      }
    ]
  },

  reactThreeFiber: {
    name: "React Three Fiber",
    package: "@react-three/fiber",
    description: "React renderer for Three.js - 3D graphics in React",
    components: [
      {
        name: "FloatingCube",
        description: "Animated 3D cube with rotation and floating effect",
        installation: "npm install @react-three/fiber @react-three/drei three",
        dependencies: {
          "@react-three/fiber": "^8.15.0",
          "@react-three/drei": "^9.88.0",
          "three": "^0.158.0"
        },
        usage: `import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useRef } from 'react';

function RotatingCube() {
  const meshRef = useRef();

  useFrame((state, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.x += delta * 0.5;
      meshRef.current.rotation.y += delta * 0.3;
      meshRef.current.position.y = Math.sin(state.clock.elapsedTime) * 0.3;
    }
  });

  return (
    <mesh ref={meshRef}>
      <boxGeometry args={[2, 2, 2]} />
      <meshStandardMaterial color="#ff6b6b" metalness={0.3} roughness={0.4} />
    </mesh>
  );
}

export function FloatingCube() {
  return (
    <div style={{ width: '100%', height: '500px' }}>
      <Canvas camera={{ position: [5, 5, 5] }}>
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={1} />
        <RotatingCube />
        <OrbitControls enableZoom={true} />
      </Canvas>
    </div>
  );
}`,
        examples: [
          '<FloatingCube />',
          '<Canvas><RotatingCube /></Canvas>'
        ]
      },
      {
        name: "ParticleField",
        description: "3D particle system with animation",
        installation: "npm install @react-three/fiber @react-three/drei three",
        dependencies: {
          "@react-three/fiber": "^8.15.0",
          "@react-three/drei": "^9.88.0",
          "three": "^0.158.0"
        },
        usage: `import { Canvas, useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';

function Particles({ count = 1000 }) {
  const mesh = useRef();

  const particles = useMemo(() => {
    const temp = [];
    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * 10;
      const y = (Math.random() - 0.5) * 10;
      const z = (Math.random() - 0.5) * 10;
      temp.push(x, y, z);
    }
    return new Float32Array(temp);
  }, [count]);

  useFrame((state) => {
    if (mesh.current) {
      mesh.current.rotation.x = state.clock.elapsedTime * 0.05;
      mesh.current.rotation.y = state.clock.elapsedTime * 0.075;
    }
  });

  return (
    <points ref={mesh}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={particles.length / 3}
          array={particles}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial size={0.05} color="#4ec9ff" sizeAttenuation transparent opacity={0.8} />
    </points>
  );
}

export function ParticleField() {
  return (
    <div style={{ width: '100%', height: '600px', background: '#000' }}>
      <Canvas camera={{ position: [0, 0, 5] }}>
        <Particles count={2000} />
      </Canvas>
    </div>
  );
}`,
        examples: [
          '<ParticleField />',
          '<ParticleField count={5000} />'
        ]
      },
      {
        name: "AnimatedSphere",
        description: "Rotating sphere with wireframe and glow effect",
        installation: "npm install @react-three/fiber @react-three/drei three",
        dependencies: {
          "@react-three/fiber": "^8.15.0",
          "@react-three/drei": "^9.88.0",
          "three": "^0.158.0"
        },
        usage: `import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Sphere } from '@react-three/drei';
import { useRef } from 'react';

function RotatingSphere() {
  const sphereRef = useRef();

  useFrame((state, delta) => {
    if (sphereRef.current) {
      sphereRef.current.rotation.y += delta * 0.3;
    }
  });

  return (
    <group ref={sphereRef}>
      <Sphere args={[1.5, 32, 32]}>
        <meshStandardMaterial
          color="#8b5cf6"
          wireframe={false}
          metalness={0.8}
          roughness={0.2}
        />
      </Sphere>
      <Sphere args={[1.52, 32, 32]}>
        <meshBasicMaterial color="#a78bfa" wireframe opacity={0.3} transparent />
      </Sphere>
    </group>
  );
}

export function AnimatedSphere() {
  return (
    <div style={{ width: '100%', height: '500px', background: '#0f0f0f' }}>
      <Canvas camera={{ position: [0, 0, 5] }}>
        <ambientLight intensity={0.3} />
        <pointLight position={[10, 10, 10]} intensity={1.5} />
        <RotatingSphere />
        <OrbitControls />
      </Canvas>
    </div>
  );
}`,
        examples: [
          '<AnimatedSphere />'
        ]
      }
    ]
  },

  lenis: {
    name: "Lenis",
    package: "@studio-freight/lenis",
    description: "Ultra-smooth scrolling library (3KB) - trending in modern crypto sites",
    components: [
      {
        name: "SmoothScroll",
        description: "Smooth scrolling wrapper for entire page",
        installation: "npm install @studio-freight/lenis",
        dependencies: {
          "@studio-freight/lenis": "^1.0.42"
        },
        usage: `import Lenis from '@studio-freight/lenis';
import { useEffect } from 'react';

export function SmoothScroll({ children }) {
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      gestureOrientation: 'vertical',
      smoothWheel: true,
      wheelMultiplier: 1,
      smoothTouch: false,
      touchMultiplier: 2,
      infinite: false,
    });

    function raf(time) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }

    requestAnimationFrame(raf);

    return () => {
      lenis.destroy();
    };
  }, []);

  return <>{children}</>;
}`,
        examples: [
          '<SmoothScroll><YourApp /></SmoothScroll>',
          'Wrap your entire app for smooth scrolling'
        ]
      },
      {
        name: "ScrollVelocity",
        description: "Access scroll velocity for velocity-based animations",
        installation: "npm install @studio-freight/lenis",
        dependencies: {
          "@studio-freight/lenis": "^1.0.42"
        },
        usage: `import Lenis from '@studio-freight/lenis';
import { useEffect, useState } from 'react';

export function ScrollVelocity({ children }) {
  const [velocity, setVelocity] = useState(0);

  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    });

    lenis.on('scroll', ({ velocity: v }) => {
      setVelocity(v);
    });

    function raf(time) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }

    requestAnimationFrame(raf);
    return () => lenis.destroy();
  }, []);

  return (
    <div style={{ '--scroll-velocity': Math.abs(velocity) }}>
      {typeof children === 'function' ? children(velocity) : children}
    </div>
  );
}`,
        examples: [
          '<ScrollVelocity>{(velocity) => <div>Velocity: {velocity}</div>}</ScrollVelocity>'
        ]
      }
    ]
  },

  gsap: {
    name: "GSAP",
    package: "gsap",
    description: "Professional-grade JavaScript animation library with ScrollTrigger",
    components: [
      {
        name: "CountUp",
        description: "Animated number counter for crypto prices and metrics",
        installation: "npm install gsap",
        dependencies: {
          "gsap": "^3.12.5"
        },
        usage: `import { useEffect, useRef } from 'react';
import gsap from 'gsap';

export function CountUp({ value, duration = 2, prefix = '', suffix = '', decimals = 0 }) {
  const elementRef = useRef(null);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const obj = { value: 0 };

    gsap.to(obj, {
      value: value,
      duration: duration,
      ease: 'power2.out',
      onUpdate: () => {
        element.textContent = prefix + obj.value.toFixed(decimals) + suffix;
      }
    });
  }, [value, duration, prefix, suffix, decimals]);

  return <span ref={elementRef}>0</span>;
}`,
        examples: [
          '<CountUp value={45000} prefix="$" decimals={2} />',
          '<CountUp value={1234567} suffix=" users" />',
          '<div className="text-4xl font-bold"><CountUp value={99.99} prefix="$" decimals={2} /></div>'
        ]
      },
      {
        name: "SplitText",
        description: "Text reveal animation with character splitting",
        installation: "npm install gsap",
        dependencies: {
          "gsap": "^3.12.5"
        },
        usage: `import { useEffect, useRef } from 'react';
import gsap from 'gsap';

export function SplitText({ children, stagger = 0.03 }) {
  const containerRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const text = container.textContent;
    container.innerHTML = text
      .split('')
      .map((char) => \`<span style="display: inline-block; opacity: 0;">\${char === ' ' ? '&nbsp;' : char}</span>\`)
      .join('');

    const chars = container.querySelectorAll('span');

    gsap.fromTo(
      chars,
      { opacity: 0, y: 20 },
      {
        opacity: 1,
        y: 0,
        stagger: stagger,
        duration: 0.5,
        ease: 'back.out(1.7)'
      }
    );
  }, [children, stagger]);

  return <div ref={containerRef}>{children}</div>;
}`,
        examples: [
          '<SplitText>Welcome to the Future</SplitText>',
          '<h1 className="text-6xl font-bold"><SplitText stagger={0.05}>CRYPTO</SplitText></h1>'
        ]
      },
      {
        name: "ScrollTriggerFade",
        description: "Fade in elements on scroll using ScrollTrigger",
        installation: "npm install gsap",
        dependencies: {
          "gsap": "^3.12.5"
        },
        usage: `import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export function ScrollTriggerFade({ children, direction = 'up' }) {
  const elementRef = useRef(null);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const directions = {
      up: { y: 50, x: 0 },
      down: { y: -50, x: 0 },
      left: { y: 0, x: 50 },
      right: { y: 0, x: -50 }
    };

    gsap.fromTo(
      element,
      {
        opacity: 0,
        ...directions[direction]
      },
      {
        opacity: 1,
        y: 0,
        x: 0,
        duration: 1,
        scrollTrigger: {
          trigger: element,
          start: 'top 80%',
          end: 'top 20%',
          toggleActions: 'play none none reverse'
        }
      }
    );

    return () => {
      ScrollTrigger.getAll().forEach(trigger => trigger.kill());
    };
  }, [direction]);

  return <div ref={elementRef}>{children}</div>;
}`,
        examples: [
          '<ScrollTriggerFade><Card>Appears on scroll</Card></ScrollTriggerFade>',
          '<ScrollTriggerFade direction="left"><h2>Slide in from left</h2></ScrollTriggerFade>'
        ]
      },
      {
        name: "Timeline",
        description: "Sequence multiple animations with GSAP Timeline",
        installation: "npm install gsap",
        dependencies: {
          "gsap": "^3.12.5"
        },
        usage: `import { useEffect, useRef } from 'react';
import gsap from 'gsap';

export function Timeline({ children }) {
  const containerRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const items = container.querySelectorAll('.timeline-item');

    const tl = gsap.timeline();

    items.forEach((item, index) => {
      tl.fromTo(
        item,
        { opacity: 0, x: -50 },
        { opacity: 1, x: 0, duration: 0.6, ease: 'power2.out' },
        index * 0.2
      );
    });
  }, []);

  return <div ref={containerRef}>{children}</div>;
}

// Usage with timeline items
export function TimelineItem({ children }) {
  return <div className="timeline-item">{children}</div>;
}`,
        examples: [
          '<Timeline><TimelineItem>Step 1</TimelineItem><TimelineItem>Step 2</TimelineItem></Timeline>'
        ]
      }
    ]
  },

  lucideReact: {
    name: "Lucide React",
    package: "lucide-react",
    description: "Modern, lightweight icon library - tree-shakeable SVG icons",
    components: [
      {
        name: "IconShowcase",
        description: "Commonly used Lucide icons for crypto and web3 sites",
        installation: "npm install lucide-react",
        dependencies: {
          "lucide-react": "^0.294.0"
        },
        usage: `import {
  Wallet,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Activity,
  DollarSign,
  Bitcoin,
  Coins,
  ArrowUpRight,
  ArrowDownRight,
  Settings,
  User,
  Menu,
  X,
  ChevronDown,
  ExternalLink,
  Github,
  Twitter,
  Send
} from 'lucide-react';

export function IconShowcase() {
  return (
    <div className="flex flex-wrap gap-4 p-4">
      <Wallet className="w-6 h-6" />
      <TrendingUp className="w-6 h-6 text-green-500" />
      <TrendingDown className="w-6 h-6 text-red-500" />
      <BarChart3 className="w-6 h-6" />
      <Activity className="w-6 h-6" />
      <DollarSign className="w-6 h-6" />
      <Bitcoin className="w-6 h-6" />
      <Coins className="w-6 h-6" />
      <ArrowUpRight className="w-6 h-6 text-green-500" />
      <ArrowDownRight className="w-6 h-6 text-red-500" />
    </div>
  );
}

// Individual icon usage
export function PriceCard({ price, change }) {
  return (
    <div className="flex items-center gap-2">
      <DollarSign className="w-5 h-5" />
      <span className="text-2xl font-bold">{price}</span>
      {change > 0 ? (
        <TrendingUp className="w-5 h-5 text-green-500" />
      ) : (
        <TrendingDown className="w-5 h-5 text-red-500" />
      )}
    </div>
  );
}`,
        examples: [
          '<Wallet className="w-6 h-6" />',
          '<TrendingUp className="w-6 h-6 text-green-500" />',
          '<IconShowcase />'
        ]
      }
    ]
  },

  tremor: {
    name: "Tremor",
    package: "@tremor/react",
    description: "React components for data visualization - built for crypto dashboards",
    components: [
      {
        name: "AreaChart",
        description: "Area chart for crypto price trends",
        installation: "npm install @tremor/react",
        dependencies: {
          "@tremor/react": "^3.14.0"
        },
        usage: `import { AreaChart } from '@tremor/react';

const priceData = [
  { date: 'Jan 1', price: 45000 },
  { date: 'Jan 2', price: 46500 },
  { date: 'Jan 3', price: 44800 },
  { date: 'Jan 4', price: 47200 },
  { date: 'Jan 5', price: 48000 },
];

export function CryptoPriceChart() {
  return (
    <AreaChart
      className="h-80"
      data={priceData}
      index="date"
      categories={["price"]}
      colors={["blue"]}
      valueFormatter={(value) => \`$\${value.toLocaleString()}\`}
      yAxisWidth={60}
      showAnimation={true}
    />
  );
}`,
        examples: [
          '<AreaChart data={priceData} index="date" categories={["price"]} />',
          '<CryptoPriceChart />'
        ]
      },
      {
        name: "BarChart",
        description: "Bar chart for volume and comparison data",
        installation: "npm install @tremor/react",
        dependencies: {
          "@tremor/react": "^3.14.0"
        },
        usage: `import { BarChart } from '@tremor/react';

const volumeData = [
  { name: 'BTC', volume: 1200000 },
  { name: 'ETH', volume: 850000 },
  { name: 'USDT', volume: 2100000 },
  { name: 'BNB', volume: 450000 },
];

export function VolumeChart() {
  return (
    <BarChart
      className="h-72"
      data={volumeData}
      index="name"
      categories={["volume"]}
      colors={["blue"]}
      valueFormatter={(value) => \`$\${(value / 1000).toFixed(0)}K\`}
      yAxisWidth={48}
    />
  );
}`,
        examples: [
          '<BarChart data={volumeData} index="name" categories={["volume"]} />',
          '<VolumeChart />'
        ]
      },
      {
        name: "DonutChart",
        description: "Donut chart for portfolio allocation",
        installation: "npm install @tremor/react",
        dependencies: {
          "@tremor/react": "^3.14.0"
        },
        usage: `import { DonutChart } from '@tremor/react';

const portfolioData = [
  { name: 'Bitcoin', value: 45000 },
  { name: 'Ethereum', value: 25000 },
  { name: 'Stablecoins', value: 15000 },
  { name: 'Altcoins', value: 15000 },
];

export function PortfolioChart() {
  return (
    <DonutChart
      className="h-80"
      data={portfolioData}
      category="value"
      index="name"
      valueFormatter={(value) => \`$\${value.toLocaleString()}\`}
      colors={["orange", "blue", "green", "purple"]}
      showAnimation={true}
    />
  );
}`,
        examples: [
          '<DonutChart data={portfolioData} category="value" index="name" />',
          '<PortfolioChart />'
        ]
      },
      {
        name: "Metric",
        description: "Large metric display for key numbers",
        installation: "npm install @tremor/react",
        dependencies: {
          "@tremor/react": "^3.14.0"
        },
        usage: `import { Card, Metric, Text, Flex, BadgeDelta } from '@tremor/react';

export function MetricCard({ title, value, change, changeType }) {
  return (
    <Card className="max-w-xs">
      <Text>{title}</Text>
      <Metric>{value}</Metric>
      <Flex className="mt-4">
        <Text>vs. previous period</Text>
        <BadgeDelta deltaType={changeType}>{change}</BadgeDelta>
      </Flex>
    </Card>
  );
}`,
        examples: [
          '<Metric>$45,231.89</Metric>',
          '<MetricCard title="Total Value" value="$45,231.89" change="+12.5%" changeType="increase" />'
        ]
      },
      {
        name: "KPICard",
        description: "KPI card with trend indicator",
        installation: "npm install @tremor/react",
        dependencies: {
          "@tremor/react": "^3.14.0"
        },
        usage: `import { Card, Text, Metric, Flex, BadgeDelta, ProgressBar } from '@tremor/react';

export function KPICard({ title, metric, progress, target, delta, deltaType }) {
  return (
    <Card className="max-w-sm">
      <Flex alignItems="start">
        <div>
          <Text>{title}</Text>
          <Metric>{metric}</Metric>
        </div>
        <BadgeDelta deltaType={deltaType}>{delta}</BadgeDelta>
      </Flex>
      <Flex className="mt-4">
        <Text className="truncate">{\`\${progress}% of \${target}\`}</Text>
        <Text>{progress}%</Text>
      </Flex>
      <ProgressBar value={progress} className="mt-2" />
    </Card>
  );
}`,
        examples: [
          '<KPICard title="Revenue" metric="$45,231" progress={68} target="$70,000" delta="+12.3%" deltaType="increase" />'
        ]
      }
    ]
  },

  motion: {
    name: "Motion (Motion One)",
    package: "motion",
    description: "Modern, lightweight animation library - 5KB alternative to Framer Motion",
    components: [
      {
        name: "MotionFade",
        description: "Lightweight fade-in animation using Motion One",
        installation: "npm install motion",
        dependencies: {
          "motion": "^10.16.4"
        },
        usage: `import { useEffect, useRef } from 'react';
import { animate } from 'motion';

export function MotionFade({ children, delay = 0 }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current) return;

    animate(
      ref.current,
      { opacity: [0, 1], transform: ['translateY(20px)', 'translateY(0)'] },
      { duration: 0.6, delay, easing: 'ease-out' }
    );
  }, [delay]);

  return <div ref={ref}>{children}</div>;
}`,
        examples: [
          '<MotionFade><h1>Fade In</h1></MotionFade>',
          '<MotionFade delay={0.2}>Delayed fade</MotionFade>'
        ]
      },
      {
        name: "MotionStagger",
        description: "Stagger animation for list items",
        installation: "npm install motion",
        dependencies: {
          "motion": "^10.16.4"
        },
        usage: `import { useEffect, useRef } from 'react';
import { stagger, animate } from 'motion';

export function MotionStagger({ children, staggerDelay = 0.1 }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current) return;

    const items = ref.current.querySelectorAll('.stagger-item');

    animate(
      items,
      { opacity: [0, 1], transform: ['translateY(20px)', 'translateY(0)'] },
      { duration: 0.5, delay: stagger(staggerDelay), easing: 'ease-out' }
    );
  }, [staggerDelay]);

  return <div ref={ref}>{children}</div>;
}

export function StaggerItem({ children }) {
  return <div className="stagger-item">{children}</div>;
}`,
        examples: [
          '<MotionStagger>{items.map(item => <StaggerItem key={item}>{item}</StaggerItem>)}</MotionStagger>'
        ]
      },
      {
        name: "SpringAnimation",
        description: "Spring physics animation with Motion One",
        installation: "npm install motion",
        dependencies: {
          "motion": "^10.16.4"
        },
        usage: `import { useEffect, useRef } from 'react';
import { animate, spring } from 'motion';

export function SpringAnimation({ children }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current) return;

    animate(
      ref.current,
      { transform: ['scale(0.8)', 'scale(1)'], opacity: [0, 1] },
      { easing: spring({ stiffness: 200, damping: 15 }) }
    );
  }, []);

  return <div ref={ref}>{children}</div>;
}`,
        examples: [
          '<SpringAnimation><button>Bouncy Button</button></SpringAnimation>'
        ]
      },
      {
        name: "ScrollAnimation",
        description: "Scroll-triggered animation with Motion One",
        installation: "npm install motion",
        dependencies: {
          "motion": "^10.16.4"
        },
        usage: `import { useEffect, useRef } from 'react';
import { scroll, animate } from 'motion';

export function ScrollAnimation({ children }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current) return;

    scroll(
      animate(
        ref.current,
        { opacity: [0, 1], transform: ['translateY(50px)', 'translateY(0)'] }
      ),
      { target: ref.current, offset: ['start end', 'start center'] }
    );
  }, []);

  return <div ref={ref}>{children}</div>;
}`,
        examples: [
          '<ScrollAnimation><Card>Animates on scroll</Card></ScrollAnimation>'
        ]
      }
    ]
  },

  reactSpring: {
    name: "React Spring",
    package: "react-spring",
    description: "Spring-physics based animation library for natural-feeling motion",
    components: [
      {
        name: "SpringFade",
        description: "Spring-based fade-in animation",
        installation: "npm install react-spring",
        dependencies: {
          "react-spring": "^9.7.3"
        },
        usage: `import { useSpring, animated } from 'react-spring';

export function SpringFade({ children, delay = 0 }) {
  const props = useSpring({
    from: { opacity: 0, transform: 'translateY(20px)' },
    to: { opacity: 1, transform: 'translateY(0)' },
    delay,
    config: { tension: 200, friction: 20 }
  });

  return <animated.div style={props}>{children}</animated.div>;
}`,
        examples: [
          '<SpringFade><h1>Smooth Spring Fade</h1></SpringFade>',
          '<SpringFade delay={300}>Delayed</SpringFade>'
        ]
      },
      {
        name: "SpringScale",
        description: "Bouncy scale animation with spring physics",
        installation: "npm install react-spring",
        dependencies: {
          "react-spring": "^9.7.3"
        },
        usage: `import { useSpring, animated } from 'react-spring';

export function SpringScale({ children }) {
  const props = useSpring({
    from: { transform: 'scale(0.5)', opacity: 0 },
    to: { transform: 'scale(1)', opacity: 1 },
    config: { tension: 300, friction: 10 }
  });

  return <animated.div style={props}>{children}</animated.div>;
}`,
        examples: [
          '<SpringScale><button>Bouncy Button</button></SpringScale>'
        ]
      },
      {
        name: "SpringTrail",
        description: "Staggered animation with spring physics",
        installation: "npm install react-spring",
        dependencies: {
          "react-spring": "^9.7.3"
        },
        usage: `import { useTrail, animated } from 'react-spring';

export function SpringTrail({ children, items }) {
  const trail = useTrail(items.length, {
    from: { opacity: 0, transform: 'translateY(20px)' },
    to: { opacity: 1, transform: 'translateY(0)' },
    config: { tension: 200, friction: 20 }
  });

  return (
    <div>
      {trail.map((props, index) => (
        <animated.div key={index} style={props}>
          {items[index]}
        </animated.div>
      ))}
    </div>
  );
}`,
        examples: [
          '<SpringTrail items={[<Card>1</Card>, <Card>2</Card>, <Card>3</Card>]} />'
        ]
      }
    ]
  },

  radixUI: {
    name: "Radix UI",
    package: "@radix-ui/react-*",
    description: "Unstyled, accessible UI primitives - foundation for modern component libraries",
    components: [
      {
        name: "Dialog",
        description: "Accessible modal dialog component",
        installation: "npm install @radix-ui/react-dialog",
        dependencies: {
          "@radix-ui/react-dialog": "^1.0.5"
        },
        usage: `import * as Dialog from '@radix-ui/react-dialog';

export function DialogDemo() {
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <button className="px-4 py-2 bg-blue-500 text-white rounded">
          Open Dialog
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg p-6 w-[90vw] max-w-md">
          <Dialog.Title className="text-xl font-bold mb-4">
            Dialog Title
          </Dialog.Title>
          <Dialog.Description className="text-gray-600 mb-4">
            This is a description of the dialog content.
          </Dialog.Description>
          <div className="flex justify-end gap-2">
            <Dialog.Close asChild>
              <button className="px-4 py-2 bg-gray-200 rounded">Cancel</button>
            </Dialog.Close>
            <button className="px-4 py-2 bg-blue-500 text-white rounded">
              Confirm
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}`,
        examples: [
          '<DialogDemo />'
        ]
      },
      {
        name: "DropdownMenu",
        description: "Accessible dropdown menu component",
        installation: "npm install @radix-ui/react-dropdown-menu",
        dependencies: {
          "@radix-ui/react-dropdown-menu": "^2.0.6"
        },
        usage: `import * as DropdownMenu from '@radix-ui/react-dropdown-menu';

export function DropdownDemo() {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button className="px-4 py-2 bg-blue-500 text-white rounded">
          Options
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className="bg-white rounded-lg shadow-lg p-2 min-w-[200px]">
          <DropdownMenu.Item className="px-3 py-2 hover:bg-gray-100 rounded cursor-pointer">
            Profile
          </DropdownMenu.Item>
          <DropdownMenu.Item className="px-3 py-2 hover:bg-gray-100 rounded cursor-pointer">
            Settings
          </DropdownMenu.Item>
          <DropdownMenu.Separator className="h-px bg-gray-200 my-1" />
          <DropdownMenu.Item className="px-3 py-2 hover:bg-gray-100 rounded cursor-pointer text-red-600">
            Logout
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}`,
        examples: [
          '<DropdownDemo />'
        ]
      },
      {
        name: "Tooltip",
        description: "Accessible tooltip component",
        installation: "npm install @radix-ui/react-tooltip",
        dependencies: {
          "@radix-ui/react-tooltip": "^1.0.7"
        },
        usage: `import * as Tooltip from '@radix-ui/react-tooltip';

export function TooltipDemo() {
  return (
    <Tooltip.Provider>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <button className="px-4 py-2 bg-gray-200 rounded">
            Hover me
          </button>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            className="bg-gray-900 text-white px-3 py-2 rounded text-sm"
            sideOffset={5}
          >
            Tooltip content
            <Tooltip.Arrow className="fill-gray-900" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}`,
        examples: [
          '<TooltipDemo />'
        ]
      },
      {
        name: "Tabs",
        description: "Accessible tabs component",
        installation: "npm install @radix-ui/react-tabs",
        dependencies: {
          "@radix-ui/react-tabs": "^1.0.4"
        },
        usage: `import * as Tabs from '@radix-ui/react-tabs';

export function TabsDemo() {
  return (
    <Tabs.Root defaultValue="tab1" className="w-full">
      <Tabs.List className="flex border-b">
        <Tabs.Trigger
          value="tab1"
          className="px-4 py-2 hover:bg-gray-100 data-[state=active]:border-b-2 data-[state=active]:border-blue-500"
        >
          Tab 1
        </Tabs.Trigger>
        <Tabs.Trigger
          value="tab2"
          className="px-4 py-2 hover:bg-gray-100 data-[state=active]:border-b-2 data-[state=active]:border-blue-500"
        >
          Tab 2
        </Tabs.Trigger>
      </Tabs.List>
      <Tabs.Content value="tab1" className="p-4">
        Content for tab 1
      </Tabs.Content>
      <Tabs.Content value="tab2" className="p-4">
        Content for tab 2
      </Tabs.Content>
    </Tabs.Root>
  );
}`,
        examples: [
          '<TabsDemo />'
        ]
      },
      {
        name: "Accordion",
        description: "Accessible accordion component",
        installation: "npm install @radix-ui/react-accordion",
        dependencies: {
          "@radix-ui/react-accordion": "^1.1.2"
        },
        usage: `import * as Accordion from '@radix-ui/react-accordion';

export function AccordionDemo() {
  return (
    <Accordion.Root type="single" collapsible className="w-full">
      <Accordion.Item value="item-1" className="border-b">
        <Accordion.Trigger className="flex justify-between w-full py-4 font-medium hover:underline">
          Question 1?
        </Accordion.Trigger>
        <Accordion.Content className="pb-4 text-gray-600">
          Answer to question 1
        </Accordion.Content>
      </Accordion.Item>
      <Accordion.Item value="item-2" className="border-b">
        <Accordion.Trigger className="flex justify-between w-full py-4 font-medium hover:underline">
          Question 2?
        </Accordion.Trigger>
        <Accordion.Content className="pb-4 text-gray-600">
          Answer to question 2
        </Accordion.Content>
      </Accordion.Item>
    </Accordion.Root>
  );
}`,
        examples: [
          '<AccordionDemo />'
        ]
      }
    ]
  }
};

// ============================================================================
// MCP SERVER
// ============================================================================

const server = new Server(
  {
    name: "ui-libraries-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "list_ui_libraries",
        description: "List all available UI libraries and their components",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "get_component",
        description: "Get detailed information about a specific component including code, usage, and examples",
        inputSchema: {
          type: "object",
          properties: {
            library: {
              type: "string",
              description: "Library name (framerMotion, shadcnUI, aceternity, magicUI, reactThreeFiber, lenis, gsap, lucideReact, tremor, motion, reactSpring, radixUI)",
              enum: ["framerMotion", "shadcnUI", "aceternity", "magicUI", "reactThreeFiber", "lenis", "gsap", "lucideReact", "tremor", "motion", "reactSpring", "radixUI"]
            },
            componentName: {
              type: "string",
              description: "Name of the component to retrieve"
            }
          },
          required: ["library", "componentName"]
        }
      },
      {
        name: "search_components",
        description: "Search for components by keyword or use case",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Search query (e.g., 'animation', 'button', 'card', 'parallax')"
            }
          },
          required: ["query"]
        }
      },
      {
        name: "get_library_info",
        description: "Get information about a specific UI library",
        inputSchema: {
          type: "object",
          properties: {
            library: {
              type: "string",
              description: "Library name",
              enum: ["framerMotion", "shadcnUI", "aceternity", "magicUI", "reactThreeFiber", "lenis", "gsap", "lucideReact", "tremor", "motion", "reactSpring", "radixUI"]
            }
          },
          required: ["library"]
        }
      },
      {
        name: "fetch_npm_package",
        description: "Fetch real package info (version, description, README, dependencies) from npm registry. Results are cached for 24h.",
        inputSchema: {
          type: "object",
          properties: {
            packageName: {
              type: "string",
              description: "npm package name (e.g., 'framer-motion', '@radix-ui/react-dialog')"
            }
          },
          required: ["packageName"]
        }
      },
      {
        name: "discover_components",
        description: "Discover components from a real npm package by parsing its README. Returns component names, import paths, and descriptions found in the docs.",
        inputSchema: {
          type: "object",
          properties: {
            packageName: {
              type: "string",
              description: "npm package name to discover components from"
            }
          },
          required: ["packageName"]
        }
      },
      {
        name: "search_npm",
        description: "Search the npm registry for React UI component packages. Use this when the local catalog doesn't have what you need.",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Search query (e.g., 'react date picker', 'react carousel')"
            },
            size: {
              type: "number",
              description: "Max results (default 10, max 20)"
            }
          },
          required: ["query"]
        }
      },
      {
        name: "refresh_versions",
        description: "Fetch latest versions from npm for all hard-coded libraries. Returns a map of package -> latest version.",
        inputSchema: {
          type: "object",
          properties: {},
        }
      },
      {
        name: "cache_stats",
        description: "Get stats about the npm fetch cache (size, entries, age)",
        inputSchema: {
          type: "object",
          properties: {},
        }
      }
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case "list_ui_libraries": {
      const libraries = Object.entries(UI_LIBRARIES).map(([key, lib]) => ({
        id: key,
        name: lib.name,
        package: lib.package,
        description: lib.description,
        componentCount: lib.components.length,
        components: lib.components.map(c => c.name)
      }));

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(libraries, null, 2)
          }
        ]
      };
    }

    case "get_component": {
      const { library, componentName } = args as { library: string; componentName: string };

      const lib = UI_LIBRARIES[library as keyof typeof UI_LIBRARIES];
      if (!lib) {
        return {
          content: [{ type: "text", text: `Library '${library}' not found` }],
          isError: true
        };
      }

      const component = lib.components.find(c => c.name === componentName);
      if (!component) {
        return {
          content: [{ type: "text", text: `Component '${componentName}' not found in ${lib.name}` }],
          isError: true
        };
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              name: component.name,
              library: lib.name,
              description: component.description,
              installation: component.installation,
              dependencies: component.dependencies,
              usage: component.usage,
              examples: component.examples
            }, null, 2)
          }
        ]
      };
    }

    case "search_components": {
      const { query } = args as { query: string };
      const lowerQuery = query.toLowerCase();

      const results: any[] = [];

      Object.entries(UI_LIBRARIES).forEach(([libKey, lib]) => {
        lib.components.forEach(component => {
          const matchesName = component.name.toLowerCase().includes(lowerQuery);
          const matchesDescription = component.description.toLowerCase().includes(lowerQuery);

          if (matchesName || matchesDescription) {
            results.push({
              name: component.name,
              library: lib.name,
              libraryKey: libKey,
              description: component.description,
              usage: component.usage.substring(0, 200) + "..."
            });
          }
        });
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              query,
              resultsCount: results.length,
              results
            }, null, 2)
          }
        ]
      };
    }

    case "get_library_info": {
      const { library } = args as { library: string };

      const lib = UI_LIBRARIES[library as keyof typeof UI_LIBRARIES];
      if (!lib) {
        return {
          content: [{ type: "text", text: `Library '${library}' not found` }],
          isError: true
        };
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              name: lib.name,
              package: lib.package,
              description: lib.description,
              componentCount: lib.components.length,
              components: lib.components.map(c => ({
                name: c.name,
                description: c.description
              }))
            }, null, 2)
          }
        ]
      };
    }

    case "fetch_npm_package": {
      const { packageName } = args as { packageName: string };

      const pkg = await fetchNpmPackage(packageName);
      if (!pkg) {
        return {
          content: [{ type: "text", text: `Failed to fetch package '${packageName}' from npm` }],
          isError: true
        };
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              name: pkg.name,
              version: pkg.version,
              description: pkg.description,
              homepage: pkg.homepage,
              keywords: pkg.keywords,
              dependencies: pkg.dependencies,
              peerDependencies: pkg.peerDependencies,
              readmePreview: pkg.readme?.substring(0, 2000) + (pkg.readme && pkg.readme.length > 2000 ? "..." : ""),
              source: "npm-live",
              cachedAt: new Date(pkg.fetchedAt).toISOString()
            }, null, 2)
          }
        ]
      };
    }

    case "discover_components": {
      const { packageName } = args as { packageName: string };

      const components = await discoverComponents(packageName);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              packageName,
              componentsFound: components.length,
              components,
              source: "npm-live"
            }, null, 2)
          }
        ]
      };
    }

    case "search_npm": {
      const { query, size } = args as { query: string; size?: number };
      const clampedSize = Math.min(size || 10, 20);

      const results = await searchNpm(query, clampedSize);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              query,
              resultsCount: results.length,
              results,
              source: "npm-live"
            }, null, 2)
          }
        ]
      };
    }

    case "refresh_versions": {
      // Collect all unique package names from hard-coded catalog
      const packageNames = new Set<string>();
      Object.values(UI_LIBRARIES).forEach(lib => {
        // Add the main package
        if (lib.package && !lib.package.includes("*")) {
          packageNames.add(lib.package);
        }
        // Add component dependencies
        lib.components.forEach(comp => {
          Object.keys(comp.dependencies).forEach(dep => packageNames.add(dep));
        });
      });

      const versions = await fetchLatestVersions(Array.from(packageNames));

      // Build comparison with hard-coded versions
      const comparison: Array<{
        package: string;
        hardcoded: string;
        latest: string;
        needsUpdate: boolean;
      }> = [];

      Object.values(UI_LIBRARIES).forEach(lib => {
        lib.components.forEach(comp => {
          Object.entries(comp.dependencies).forEach(([dep, ver]) => {
            if (versions[dep]) {
              const hardcodedClean = ver.replace(/[\^~>=<]/g, "");
              comparison.push({
                package: dep,
                hardcoded: ver,
                latest: versions[dep],
                needsUpdate: hardcodedClean !== versions[dep]
              });
            }
          });
        });
      });

      // Deduplicate
      const seen = new Set<string>();
      const deduped = comparison.filter(c => {
        if (seen.has(c.package)) return false;
        seen.add(c.package);
        return true;
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              totalPackages: deduped.length,
              needsUpdate: deduped.filter(c => c.needsUpdate).length,
              versions: deduped
            }, null, 2)
          }
        ]
      };
    }

    case "cache_stats": {
      const stats = getCacheStats();
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(stats, null, 2)
          }
        ]
      };
    }

    default:
      return {
        content: [{ type: "text", text: `Unknown tool: ${name}` }],
        isError: true
      };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("UI Libraries MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
