# UI Libraries MCP Integration

This project uses **Model Context Protocol (MCP)** to give the AI access to modern UI component libraries like Framer Motion, Shadcn/ui, Aceternity UI, and Magic UI during website generation.

## 🎯 What This Does

When generating websites, the AI can now:
- **Query available UI libraries** and their components
- **Search for specific components** by keyword (e.g., "animation", "button", "gradient")
- **Get complete component code** with usage examples and dependencies
- **Automatically add dependencies** to package.json
- **Generate modern, animated UIs** using best-in-class libraries

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Website Generator                        │
│  (lib/react-generator.ts)                                   │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ Fetches UI library context
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                    MCP Client                                │
│  (lib/mcp-client.ts)                                        │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ Communicates via MCP protocol
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              UI Libraries MCP Server                         │
│  (mcp/ui-libraries-server.ts)                               │
│                                                              │
│  ├─ Framer Motion (animations)                              │
│  ├─ Shadcn UI (accessible components)                       │
│  ├─ Aceternity UI (modern animated components)              │
│  └─ Magic UI (magical effects)                              │
└─────────────────────────────────────────────────────────────┘
```

## 📚 Available Libraries

### 1. **Framer Motion** (`framer-motion`)
Production-ready motion library for React

**Available Components:**
- `FadeIn` - Smooth fade-in animation
- `SlideIn` - Slide-in from any direction
- `ScaleIn` - Scale-in with bounce effect
- `ParallaxScroll` - Parallax scrolling effect
- `StaggerChildren` - Stagger animation for lists

### 2. **Shadcn UI** (Radix UI + Tailwind)
Beautiful, accessible components

**Available Components:**
- `Button` - Accessible button with variants
- `Card` - Flexible card component

### 3. **Aceternity UI**
Modern, animated UI components

**Available Components:**
- `BentoGrid` - Responsive bento-style grid layout
- `TextGenerateEffect` - Animated text generation

### 4. **Magic UI**
Magical animated components

**Available Components:**
- `ShimmerButton` - Button with shimmer animation
- `GradientText` - Animated gradient text effect

## 🚀 How It Works

### During Generation:

1. **User submits prompt**: "Create a modern SaaS landing page with smooth animations"

2. **MCP Client extracts keywords**: `animation`, `modern`, `button`, `card`

3. **MCP Server searches components** matching these keywords

4. **Context is built** with relevant components and their code:
   ```
   🎨 AVAILABLE COMPONENTS:

   🔹 FadeIn (Framer Motion)
      Smooth fade-in animation component
      Usage: <FadeIn><h1>Hello</h1></FadeIn>

   🔹 ShimmerButton (Magic UI)
      Button with shimmer animation effect
      Usage: <ShimmerButton>Click me</ShimmerButton>
   ```

5. **AI receives enhanced prompt** with component library context

6. **AI generates code** using these modern components

7. **Dependencies are auto-added** to package.json:
   ```json
   {
     "dependencies": {
       "framer-motion": "^11.0.0",
       "clsx": "^2.0.0"
     }
   }
   ```

## 🛠️ MCP Tools Available

The UI Libraries MCP Server exposes 4 tools:

### 1. `list_ui_libraries`
Lists all available libraries and their components
```typescript
// No arguments required
```

### 2. `get_component`
Gets detailed info about a specific component
```typescript
{
  library: "framerMotion",
  componentName: "FadeIn"
}
```

### 3. `search_components`
Searches components by keyword
```typescript
{
  query: "animation"
}
```

### 4. `get_library_info`
Gets information about a library
```typescript
{
  library: "framerMotion"
}
```

## 🧪 Testing

Test the MCP server:

```bash
npm run mcp:test
```

Or test directly:

```bash
npx tsx mcp/test-ui-libraries.ts
```

## 📝 Adding New Libraries

To add a new UI library, edit `mcp/ui-libraries-server.ts`:

```typescript
const UI_LIBRARIES = {
  // ... existing libraries

  yourLibrary: {
    name: "Your Library Name",
    package: "your-package-name",
    version: "^1.0.0",
    description: "Description of your library",
    components: [
      {
        name: "ComponentName",
        description: "What this component does",
        installation: "npm install your-package-name",
        dependencies: {
          "your-package-name": "^1.0.0"
        },
        usage: `import { ComponentName } from 'your-package-name';

export function YourComponent() {
  return <ComponentName>Hello</ComponentName>;
}`,
        examples: [
          '<ComponentName>Example 1</ComponentName>',
          '<ComponentName variant="outline">Example 2</ComponentName>'
        ]
      }
    ]
  }
};
```

## 🎨 Component Format

Each component should include:

```typescript
{
  name: string;           // Component name
  description: string;    // Brief description
  installation: string;   // Installation command
  dependencies: {         // Required npm packages
    [package: string]: string;  // version
  };
  usage: string;         // Full component code
  props?: string;        // Optional: TypeScript props interface
  examples: string[];    // Usage examples
}
```

## 🔧 Configuration

The MCP client automatically:
- ✅ Connects to the MCP server when needed
- ✅ Extracts keywords from user prompts
- ✅ Searches relevant components
- ✅ Builds context for the AI
- ✅ Merges dependencies into package.json
- ✅ Disconnects when done

## 📖 Usage in Generated Sites

When the AI uses these components, they're automatically included:

**Input prompt:**
```
Create a hero section with a fade-in animation and shimmer button
```

**Generated code:**
```tsx
import { motion } from 'framer-motion';

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

function ShimmerButton({ children }) {
  return (
    <motion.button
      className="relative overflow-hidden rounded-lg bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 px-6 py-3 text-white font-semibold"
      whileHover={{ scale: 1.05 }}
    >
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
        animate={{ x: ['0%', '100%'] }}
        transition={{ repeat: Infinity, duration: 1.5 }}
      />
      {children}
    </motion.button>
  );
}

export default function Hero() {
  return (
    <FadeIn>
      <h1>Welcome to the Future</h1>
      <ShimmerButton>Get Started</ShimmerButton>
    </FadeIn>
  );
}
```

**Generated package.json:**
```json
{
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.2.0",
    "framer-motion": "^11.0.0"
  }
}
```

## 🌟 Benefits

### For Users:
- ✨ Modern, animated websites out of the box
- 🎨 Professional-looking components
- 🚀 Best-in-class libraries automatically included
- 📱 Mobile-responsive, accessible components

### For Developers:
- 🔌 Easy to extend with new libraries
- 🧩 Modular component system
- 📚 Centralized component documentation
- 🤖 AI has access to up-to-date component APIs

## 🔮 Future Extensions

Potential libraries to add:
- **React Spring** - Spring physics animations
- **GSAP** - Advanced animation library
- **Lottie** - After Effects animations
- **Three.js** - 3D graphics
- **React Three Fiber** - 3D React components
- **Recharts** - Data visualization
- **React Icons** - Icon library
- **Sonner** - Toast notifications
- **Vaul** - Drawer component
- **CMDK** - Command menu

## 🤝 Contributing

To add more components:

1. Add component info to `UI_LIBRARIES` in `mcp/ui-libraries-server.ts`
2. Test with `npm run mcp:test`
3. Update this README with the new component
4. The AI will automatically have access to it!

## 📞 Support

If the MCP server fails to connect:
- Check that `@modelcontextprotocol/sdk` is installed
- Ensure `tsx` is available (installed via devDependencies)
- Try running `npx tsx mcp/ui-libraries-server.ts` directly
- Check server logs for errors

## 🎓 Learn More

- [Model Context Protocol](https://modelcontextprotocol.io/)
- [Framer Motion Docs](https://www.framer.com/motion/)
- [Shadcn UI](https://ui.shadcn.com/)
- [Aceternity UI](https://ui.aceternity.com/)
- [Magic UI](https://magicui.design/)
