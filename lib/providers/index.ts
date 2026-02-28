import { ProviderRegistry } from './registry';
import { VercelProvider } from './vercel-provider';
import { NeonProvider } from './neon-provider';
import { AxiomProvider } from './axiom-provider';

const registry = new ProviderRegistry();

registry.register(new VercelProvider());
registry.register(new NeonProvider());
registry.register(new AxiomProvider());

export { registry };
