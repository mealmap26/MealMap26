// Escapa los comodines de LIKE para buscar el texto tal cual
export const escapeLike = (text: string): string =>
  text.replace(/[\\%_]/g, '\\$&');
