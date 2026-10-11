import { escapeLike } from './escape-like.js';

describe('escapeLike', () => {
  it('escapa los comodines de LIKE y la barra invertida', () => {
    expect(escapeLike('50%_a\\b')).toBe('50\\%\\_a\\\\b');
  });

  it('deja igual el texto sin comodines', () => {
    expect(escapeLike('Arroz blanco')).toBe('Arroz blanco');
  });
});
