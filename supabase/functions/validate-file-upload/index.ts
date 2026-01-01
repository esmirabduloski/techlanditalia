import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Allowed file types with their MIME types and magic bytes (file signatures)
const ALLOWED_FILE_TYPES = {
  // Images
  'image/jpeg': { extensions: ['jpg', 'jpeg'], magicBytes: [[0xFF, 0xD8, 0xFF]] },
  'image/png': { extensions: ['png'], magicBytes: [[0x89, 0x50, 0x4E, 0x47]] },
  'image/gif': { extensions: ['gif'], magicBytes: [[0x47, 0x49, 0x46, 0x38]] },
  'image/webp': { extensions: ['webp'], magicBytes: [[0x52, 0x49, 0x46, 0x46]] },
  'image/svg+xml': { extensions: ['svg'], magicBytes: [] }, // SVG is text-based
  
  // Documents
  'application/pdf': { extensions: ['pdf'], magicBytes: [[0x25, 0x50, 0x44, 0x46]] },
  'text/plain': { extensions: ['txt', 'py', 'html', 'css', 'js', 'json', 'md', 'lua'], magicBytes: [] },
  'text/html': { extensions: ['html', 'htm'], magicBytes: [] },
  'text/css': { extensions: ['css'], magicBytes: [] },
  'text/javascript': { extensions: ['js'], magicBytes: [] },
  'application/javascript': { extensions: ['js'], magicBytes: [] },
  'text/x-python': { extensions: ['py'], magicBytes: [] },
  'application/x-python': { extensions: ['py'], magicBytes: [] },
  'application/json': { extensions: ['json'], magicBytes: [] },
  'text/markdown': { extensions: ['md'], magicBytes: [] },
  'text/x-lua': { extensions: ['lua'], magicBytes: [] },
  
  // Microsoft Office (docx, xlsx, pptx are ZIP-based)
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { 
    extensions: ['docx'], 
    magicBytes: [[0x50, 0x4B, 0x03, 0x04]] // ZIP signature
  },
  'application/msword': { 
    extensions: ['doc'], 
    magicBytes: [[0xD0, 0xCF, 0x11, 0xE0]] // OLE compound document
  },
  
  // Archives
  'application/zip': { extensions: ['zip', 'rbxl', 'rbxlx'], magicBytes: [[0x50, 0x4B, 0x03, 0x04]] },
  'application/x-zip-compressed': { extensions: ['zip', 'rbxl', 'rbxlx'], magicBytes: [[0x50, 0x4B, 0x03, 0x04]] },
  
  // Roblox files
  'application/octet-stream': { 
    extensions: ['rbxl', 'rbxlx', 'rbxm', 'rbxmx'], 
    magicBytes: [[0x50, 0x4B, 0x03, 0x04], [0x3C, 0x72, 0x6F, 0x62]] // ZIP or <rob XML
  },
  
  // Video (for tutorials)
  'video/mp4': { extensions: ['mp4'], magicBytes: [] },
  'video/webm': { extensions: ['webm'], magicBytes: [] },
  
  // Audio
  'audio/mpeg': { extensions: ['mp3'], magicBytes: [[0xFF, 0xFB], [0xFF, 0xFA], [0x49, 0x44, 0x33]] },
  'audio/wav': { extensions: ['wav'], magicBytes: [[0x52, 0x49, 0x46, 0x46]] },
};

// Dangerous file extensions that should NEVER be allowed
const DANGEROUS_EXTENSIONS = [
  'exe', 'dll', 'bat', 'cmd', 'com', 'msi', 'scr', 'pif',
  'vbs', 'vbe', 'wsf', 'wsh', 'ps1', 'psm1',
  'sh', 'bash', 'zsh', 'csh', 'fish',
  'php', 'phtml', 'php3', 'php4', 'php5', 'phps',
  'asp', 'aspx', 'cer', 'csr',
  'jar', 'class', 'pyc', 'pyo',
  'rb', 'pl', 'cgi',
  'htaccess', 'htpasswd',
  'swf', 'flv',
  'hta', 'msc', 'msp', 'mst',
  'reg', 'inf', 'scf', 'lnk', 'url',
];

// Maximum file size (20MB for videos, 10MB for others)
const MAX_FILE_SIZE = 20 * 1024 * 1024;

interface ValidationRequest {
  fileName: string;
  fileSize: number;
  mimeType: string;
  fileBytes?: number[];
  bucket: 'homework-files' | 'web-compiler-assets' | 'homework-attachments';
}

interface ValidationResponse {
  valid: boolean;
  error?: string;
  details?: {
    fileName: string;
    mimeType: string;
    fileSize: number;
    bucket: string;
  };
}

function getFileExtension(fileName: string): string {
  const parts = fileName.toLowerCase().split('.');
  return parts.length > 1 ? parts[parts.length - 1] : '';
}

function isDangerousExtension(extension: string): boolean {
  return DANGEROUS_EXTENSIONS.includes(extension.toLowerCase());
}

function isAllowedMimeType(mimeType: string): boolean {
  return mimeType in ALLOWED_FILE_TYPES;
}

function isAllowedExtension(extension: string): boolean {
  const allowedExtensions = Object.values(ALLOWED_FILE_TYPES).flatMap(t => t.extensions);
  return allowedExtensions.includes(extension.toLowerCase());
}

function validateMagicBytes(fileBytes: number[], expectedMagicBytes: number[][]): boolean {
  if (expectedMagicBytes.length === 0) {
    return true;
  }
  
  for (const magicSequence of expectedMagicBytes) {
    if (fileBytes.length >= magicSequence.length) {
      const matches = magicSequence.every((byte, index) => fileBytes[index] === byte);
      if (matches) return true;
    }
  }
  
  return false;
}

function validateExtensionMatchesMimeType(extension: string, mimeType: string): boolean {
  const typeConfig = ALLOWED_FILE_TYPES[mimeType as keyof typeof ALLOWED_FILE_TYPES];
  if (!typeConfig) {
    // For unknown MIME types, check if extension is generally allowed
    return isAllowedExtension(extension);
  }
  return typeConfig.extensions.includes(extension.toLowerCase());
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { fileName, fileSize, mimeType, fileBytes, bucket }: ValidationRequest = await req.json();

    console.log(`Validating file: ${fileName}, size: ${fileSize}, type: ${mimeType}, bucket: ${bucket}`);

    if (!fileName || fileSize === undefined || !mimeType || !bucket) {
      console.log('Missing required fields');
      return new Response(
        JSON.stringify({ valid: false, error: 'Parametri mancanti per la validazione' } as ValidationResponse),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!['homework-files', 'web-compiler-assets', 'homework-attachments'].includes(bucket)) {
      console.log('Invalid bucket:', bucket);
      return new Response(
        JSON.stringify({ valid: false, error: 'Bucket non valido' } as ValidationResponse),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (fileSize > MAX_FILE_SIZE) {
      console.log('File too large:', fileSize);
      return new Response(
        JSON.stringify({ valid: false, error: 'Il file supera la dimensione massima di 20MB' } as ValidationResponse),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (fileSize <= 0) {
      console.log('Invalid file size:', fileSize);
      return new Response(
        JSON.stringify({ valid: false, error: 'Dimensione file non valida' } as ValidationResponse),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const extension = getFileExtension(fileName);
    
    if (!extension) {
      console.log('No file extension');
      return new Response(
        JSON.stringify({ valid: false, error: "Il file deve avere un'estensione" } as ValidationResponse),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (isDangerousExtension(extension)) {
      console.log('Dangerous extension detected:', extension);
      return new Response(
        JSON.stringify({ valid: false, error: `Tipo di file non consentito: .${extension}` } as ValidationResponse),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const allExtensions = fileName.toLowerCase().split('.').slice(1);
    for (const ext of allExtensions) {
      if (isDangerousExtension(ext)) {
        console.log('Dangerous extension in path:', ext);
        return new Response(
          JSON.stringify({ valid: false, error: 'Formato file sospetto rilevato' } as ValidationResponse),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // For homework-files bucket, be more permissive with extensions
    if (bucket === 'homework-files') {
      // Allow code files, Roblox files, images, documents
      const homeworkAllowedExtensions = [
        'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg',
        'pdf', 'txt', 'doc', 'docx', 'zip',
        'py', 'html', 'htm', 'css', 'js', 'json', 'md', 'lua',
        'rbxl', 'rbxlx', 'rbxm', 'rbxmx',
        'mp4', 'webm', 'mp3', 'wav'
      ];
      
      if (!homeworkAllowedExtensions.includes(extension)) {
        console.log('Extension not allowed for homework:', extension);
        return new Response(
          JSON.stringify({ valid: false, error: `Estensione .${extension} non consentita per i compiti` } as ValidationResponse),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      // For other buckets, check MIME type
      if (!isAllowedMimeType(mimeType) && !isAllowedExtension(extension)) {
        console.log('Invalid MIME type:', mimeType);
        return new Response(
          JSON.stringify({ valid: false, error: `Tipo MIME non consentito: ${mimeType}` } as ValidationResponse),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Validate magic bytes if provided and applicable
    if (fileBytes && fileBytes.length > 0 && isAllowedMimeType(mimeType)) {
      const typeConfig = ALLOWED_FILE_TYPES[mimeType as keyof typeof ALLOWED_FILE_TYPES];
      if (typeConfig && typeConfig.magicBytes.length > 0) {
        if (!validateMagicBytes(fileBytes, typeConfig.magicBytes)) {
          console.log('Magic bytes validation failed');
          return new Response(
            JSON.stringify({ valid: false, error: 'Il contenuto del file non corrisponde al tipo dichiarato' } as ValidationResponse),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    // Bucket-specific validation
    if (bucket === 'web-compiler-assets') {
      if (!mimeType.startsWith('image/')) {
        console.log('Non-image file for web-compiler-assets:', mimeType);
        return new Response(
          JSON.stringify({ valid: false, error: 'Solo immagini sono consentite per il compilatore web' } as ValidationResponse),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    console.log('File validation passed');
    
    return new Response(
      JSON.stringify({
        valid: true,
        details: {
          fileName,
          mimeType,
          fileSize,
          bucket,
        }
      } as ValidationResponse),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Validation error:', error);
    return new Response(
      JSON.stringify({ valid: false, error: 'Errore durante la validazione del file' } as ValidationResponse),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});