'use client';

import { useEffect } from 'react';

declare global {
    interface Window {
        SwaggerUIBundle?: any;
        SwaggerUIStandalonePreset?: any;
    }
}

const SWAGGER_CSS_ID = 'swagger-ui-css';
const SWAGGER_BUNDLE_SCRIPT_ID = 'swagger-ui-bundle';
const SWAGGER_PRESET_SCRIPT_ID = 'swagger-ui-standalone-preset';

export default function ApiDocsPage() {
    useEffect(() => {
        const ensureStylesheet = () => {
            if (document.getElementById(SWAGGER_CSS_ID)) return;
            const link = document.createElement('link');
            link.id = SWAGGER_CSS_ID;
            link.rel = 'stylesheet';
            link.href = 'https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css';
            document.head.appendChild(link);
        };

        const renderSwagger = () => {
            if (!window.SwaggerUIBundle || !window.SwaggerUIStandalonePreset) return;
            window.SwaggerUIBundle({
                url: '/api/docs',
                dom_id: '#swagger-ui',
                deepLinking: true,
                presets: [
                    window.SwaggerUIBundle.presets.apis,
                    window.SwaggerUIStandalonePreset,
                ],
                layout: 'StandaloneLayout',
            });
        };

        const ensureScripts = () => {
            // Check if both scripts are already loaded
            if (document.getElementById(SWAGGER_BUNDLE_SCRIPT_ID) &&
                document.getElementById(SWAGGER_PRESET_SCRIPT_ID)) {
                renderSwagger();
                return;
            }

            // Load bundle script first
            if (!document.getElementById(SWAGGER_BUNDLE_SCRIPT_ID)) {
                const bundleScript = document.createElement('script');
                bundleScript.id = SWAGGER_BUNDLE_SCRIPT_ID;
                bundleScript.src = 'https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js';
                bundleScript.async = true;
                bundleScript.onload = () => {
                    // After bundle loads, load the standalone preset
                    if (!document.getElementById(SWAGGER_PRESET_SCRIPT_ID)) {
                        const presetScript = document.createElement('script');
                        presetScript.id = SWAGGER_PRESET_SCRIPT_ID;
                        presetScript.src = 'https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-standalone-preset.js';
                        presetScript.async = true;
                        presetScript.onload = renderSwagger;
                        document.body.appendChild(presetScript);
                    } else {
                        renderSwagger();
                    }
                };
                document.body.appendChild(bundleScript);
            } else {
                // Bundle already loaded, just load preset
                if (!document.getElementById(SWAGGER_PRESET_SCRIPT_ID)) {
                    const presetScript = document.createElement('script');
                    presetScript.id = SWAGGER_PRESET_SCRIPT_ID;
                    presetScript.src = 'https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-standalone-preset.js';
                    presetScript.async = true;
                    presetScript.onload = renderSwagger;
                    document.body.appendChild(presetScript);
                } else {
                    renderSwagger();
                }
            }
        };

        ensureStylesheet();
        ensureScripts();

        return () => {
            // keep assets cached for future visits
        };
    }, []);

    return (
        <div style={{ padding: '24px' }}>
            <div id="swagger-ui" />
        </div>
    );
}

