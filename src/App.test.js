import { render, screen } from '@testing-library/react';
import App from './App';

test('renders Joviat logo in top bar', () => {
  render(<App />);
  const logoElement = screen.getByAltText(/logo joviat/i);
  expect(logoElement).toBeInTheDocument();
});