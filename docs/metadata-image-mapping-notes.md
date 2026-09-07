# Metadata image mapping notes

## User-provided images reviewed

1. `https://i.ibb.co/F4YnFdDX/file-0000000079d08211b2a303775471bf82.png` is a 1983x793 dark ProMcBot **Changelog** banner. It contains the text “CHANGELOG”, “NEW UPDATE”, and a prompt to check the full changelog in the dashboard. Proposed mapping: `/changelog`.

2. `https://i.ibb.co/Y73kxBMs/file-0000000009408246b4067b1f6aa57c0d.png` is a 1984x793 dark ProMcBot **Documentation** banner. It contains the text “PROMCBOT DOCS” and documentation navigation. Proposed mapping: `/dashboard/pages/docs/docs.html` and documentation child pages, or the public docs route if one exists.

Both designs are wide Open Graph banners and should be copied into project-controlled public assets before production use. Discord must receive the page-specific `og:image` URL from the final HTML; merely storing the images in the repository is not enough.

3. `https://i.ibb.co/d4nXxBLq/file-00000000313481f4b5313e12305212e2.png` is a 1983x793 **Minecraft Plugin** banner. Proposed mapping: the Minecraft plugin documentation/landing page, likely `/dashboard/pages/docs/minecraft-plugin.html`.

4. `https://i.ibb.co/21y6VqNj/file-000000000e7482469f2c668673a2050f.png` is a 1983x793 **Terms of Service** banner. Proposed mapping: `/terms-of-service`.

5. `https://i.ibb.co/N6ZSyqFS/file-000000007a6c8210978677f6156b7e77.png` is a 1983x793 **Privacy Policy** banner. Proposed mapping: `/privacy-policy`.

## Proposed final mapping

- `/changelog` → changelog banner (image 1)
- `/dashboard/pages/docs/docs.html` and documentation child pages → docs banner (image 2), unless a child page has a more specific asset
- `/dashboard/pages/docs/minecraft-plugin.html` → Minecraft Plugin banner (image 3)
- `/terms-of-service` → Terms of Service banner (image 4)
- `/privacy-policy` → Privacy Policy banner (image 5)
- `/u/:identifier` → keep the existing dynamic profile metadata card; do not replace it with one of these static banners
