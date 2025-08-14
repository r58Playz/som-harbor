import { defineConfig } from "vite";

export default defineConfig({
	server: {
		port: 4321,
		hmr: {
			protocol: 'ws',
			host: 'localhost',
			clientPort: 4321,
		}
	}
});
