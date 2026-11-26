import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t bg-muted/30 py-8 px-4">
      <div className="mx-auto max-w-7xl grid gap-8 md:grid-cols-4">
        <div>
          <h3 className="font-semibold mb-4">Hub de Aprendizaje</h3>
          <p className="text-sm text-muted-foreground">
            Catálogo centralizado de talleres, cursos y clubes de la FES
            Acatlán. Con carga asistida por IA para organizadores.
          </p>
        </div>
        <nav>
          <h4 className="font-medium mb-4">Enlaces rápidos</h4>
          <ul className="space-y-2 text-sm">
            <li>
              <Link
                href="/"
                className="text-muted-foreground hover:text-foreground"
              >
                Catálogo
              </Link>
            </li>
            <li>
              <Link
                href="/como-funciona"
                className="text-muted-foreground hover:text-foreground"
              >
                Cómo funciona
              </Link>
            </li>
            <li>
              <Link
                href="/login"
                className="text-muted-foreground hover:text-foreground"
              >
                Iniciar sesión
              </Link>
            </li>
          </ul>
        </nav>
        <nav>
          <h4 className="font-medium mb-4">Legal</h4>
          <ul className="space-y-2 text-sm">
            <li>
              <Link
                href="/privacidad"
                className="text-muted-foreground hover:text-foreground"
              >
                Política de privacidad
              </Link>
            </li>
            <li>
              <Link
                href="/terminos"
                className="text-muted-foreground hover:text-foreground"
              >
                Términos de uso
              </Link>
            </li>
            <li>
              <Link
                href="/aviso-privacidad"
                className="text-muted-foreground hover:text-foreground"
              >
                Aviso de privacidad
              </Link>
            </li>
          </ul>
        </nav>
        <div>
          <h4 className="font-medium mb-4">Contacto</h4>
          <address className="text-sm text-muted-foreground not-italic">
            <p>Facultad de Estudios Superiores Acatlán</p>
            <p>Av. Universidad s/n, Col. Los Reyes Iztacala</p>
            <p>Tlalnepantla, Edo. de México, 54090</p>
            <p className="mt-2">
              <a
                href="mailto:cloud@acatlan.unam.mx"
                className="hover:text-foreground"
              >
                cloud@acatlan.unam.mx
              </a>
            </p>
          </address>
        </div>
      </div>
      <div className="mt-8 border-t pt-8 text-center text-sm text-muted-foreground">
        <p>
          © {new Date().getFullYear()} FES Acatlán - UNAM. Proyecto de Cómputo
          en la Nube.
        </p>
      </div>
    </footer>
  );
}
