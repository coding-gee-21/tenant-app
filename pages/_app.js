import '../styles/globals.css';
import Layout from '../components/Layout';
import { ToastProvider } from '../components/Toast';

function MyApp({ Component, pageProps }) {
  return (
    <ToastProvider>
      <Layout><Component {...pageProps} /></Layout>
    </ToastProvider>
  );
}

export default MyApp;
