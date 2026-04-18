
## Diagnosi del problema

Hai ragione, ti chiedo scusa per i tentativi precedenti. Ho identificato esattamente il problema.

Il componente è `src/components/ui/switch.tsx`. Il "cerchio verde gigante" che vedi **NON è il track dello Switch** — il track attualmente è già sottile (`h-1.5 w-9`, cioè 6px × 36px). 

Il problema è il **Thumb (pallino bianco)**: è impostato a `h-3 w-3` (12px), quindi è **DOPPIO** rispetto all'altezza del track (6px). Questo fa sì che il pallino sporga sopra e sotto il track creando l'effetto "palla grande" che vedi. Inoltre il pallino bianco ha `bg-background` che in dark mode potrebbe apparire scuro/verde a causa del background.

Inoltre, controllando meglio: quando lo Switch è in stato `checked`, lo sfondo diventa `bg-primary` (verde). Se il thumb è più alto del track, l'area cliccabile/visiva del Radix Root probabilmente si espande per contenerlo, mostrando il verde tutto attorno.

## Soluzione: Switch stile Apple/Cupertino

Riscriverò `src/components/ui/switch.tsx` con le proporzioni corrette di un vero switch iOS:

- **Track**: `h-[18px] w-[32px]` — sottile e stretto, proporzioni iOS reali
- **Thumb**: `h-[14px] w-[14px]` — leggermente più piccolo del track (2px di padding sopra/sotto)
- **Padding**: nessun border, il thumb avrà `translate-x-[2px]` da spento e `translate-x-[16px]` da acceso
- **Colori**: track verde quando ON, grigio quando OFF; pallino bianco puro (`bg-white`) sempre
- **Shadow**: leggera shadow sul thumb per effetto fisico iOS

### Codice finale previsto

```tsx
<SwitchPrimitives.Root
  className="peer inline-flex h-[18px] w-[32px] shrink-0 cursor-pointer items-center rounded-full border-0 transition-colors data-[state=checked]:bg-primary data-[state=unchecked]:bg-input focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
>
  <SwitchPrimitives.Thumb
    className="pointer-events-none block h-[14px] w-[14px] rounded-full bg-white shadow-md ring-0 transition-transform data-[state=checked]:translate-x-[16px] data-[state=unchecked]:translate-x-[2px]"
  />
</SwitchPrimitives.Root>
```

## File modificati

- `src/components/ui/switch.tsx` — unica modifica, applicata globalmente a tutti gli Switch del sito

Risultato: switch piccolo, sottile, stile iOS classico, senza più cerchio verde gigante.
