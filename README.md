# Koolipäevik

Mobiilisõbralik koolipäevik Stuudiumi kasutajatele: tunnid päevade kaupa, hinded,
puudumised, aine ajalugu, konspektid ja spikker. Iga kasutaja loob konto ja näeb ainult enda andmeid.

## Kuidas see töötab

- **Leht** asub GitHub Pages'is (kaust `docs/`).
- **Kontod ja andmed** on Supabase'is (tasuta). Andmebaasi reeglid lubavad igal kasutajal näha ainult enda rida.
- **Stuudiumi andmed:** kasutaja salvestab oma Stuudiumi päeviku lehe (Cmd/Ctrl + S → „Webpage, Complete”)
  ja lohistab faili rakendusse. Faili loeb kasutaja enda brauser. Stuudiumi parooli rakendus ei näe.

## Seadistamine

### 1. Supabase
1. Loo tasuta konto ja uus projekt: https://supabase.com
2. **SQL Editor → New query**, kleebi faili `supabase-schema.sql` sisu ja vajuta **Run**.
3. **Project Settings → API**: kopeeri **Project URL** ja **anon public** võti.

### 2. Lehe ehitamine
Kopeeri `env.example.txt` → `.env.local`, täida väärtused ja käivita:
```bash
npm install
npm run build:pages
```
Tulemus tekib kausta `docs/`.

### 3. GitHub Pages
1. Loo GitHubis uus repositoorium (Public).
2. **Add file → Upload files**: lohista kõik selle kausta failid ja kaustad (v.a `node_modules`).
3. **Settings → Pages → Build and deployment**: Source = *Deploy from a branch*, Branch = `main`, kaust = `/docs`.
4. Mõne minuti pärast on leht aadressil `https://<kasutajanimi>.github.io/<repo-nimi>/`.

### 4. Supabase'i lehe aadress
Supabase'is **Authentication → URL Configuration**:
- **Site URL**: sinu GitHub Pages'i aadress
- **Redirect URLs**: sama aadress

Ilma selleta ei tööta e-posti kinnitamise ja parooli taastamise lingid.

## Kohalik arendus
```bash
npm install
npm run dev
```
Ilma `.env.local` failita töötab rakendus kohalikus režiimis: näidisandmed, ilma sisselogimiseta.

## Märkused
- „anon” võti on mõeldud avalikuks: see on lehe koodis nähtav ja see on normaalne. Andmeid kaitsevad andmebaasi reeglid.
- `service_role` võtit ära kunagi siia pane.
- AI konspekt on praegu näidisrežiimis (`synthesizeNotes()` failis `src/App.jsx`).
