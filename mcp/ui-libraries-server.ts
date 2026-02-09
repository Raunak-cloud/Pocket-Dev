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
              description: "Library name (framerMotion, shadcnUI, aceternity, magicUI)",
              enum: ["framerMotion", "shadcnUI", "aceternity", "magicUI"]
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
              enum: ["framerMotion", "shadcnUI", "aceternity", "magicUI"]
            }
          },
          required: ["library"]
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
