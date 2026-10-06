// Enlace — Link interno sin recarga total.
// Por qué: <a href="/..."> recarga el navegador (parpadeo + pierde caché TanStack).
// Uso: <Enlace to="/app" className="...">Texto</Enlace> (misma API que <a>).
import { Link } from "react-router-dom";

export default function Enlace({ to, href, ...props }) {
  return <Link to={to ?? href} {...props} />;
}
