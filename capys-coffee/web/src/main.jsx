import { Component, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import '@fontsource/fredoka/500.css';
import '@fontsource/fredoka/600.css';
import '@fontsource/fredoka/700.css';
import '@fontsource-variable/inter';
import './styles.css';
import { ToastProvider } from './components/ui.jsx';
import { ShopProvider } from './customer/store.jsx';
import MenuPage from './customer/MenuPage.jsx';
import CheckoutPage from './customer/CheckoutPage.jsx';
import TrackPage from './customer/TrackPage.jsx';
import StaffApp from './staff/StaffApp.jsx';
import DisplayBoard from './display/DisplayBoard.jsx';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error(error, info.componentStack);
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="page-center">
        <img src="/logo.svg" width="88" height="88" alt="" />
        <h2>Oops — something went wrong</h2>
        <p className="muted">Please reload the page. Your cart and orders are saved.</p>
        <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>Reload</button>
      </div>
    );
  }
}

function Shop({ children }) {
  return <ShopProvider>{children}</ShopProvider>;
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
    <BrowserRouter>
      <ToastProvider>
        <Routes>
          <Route path="/" element={<Shop><MenuPage /></Shop>} />
          <Route path="/checkout" element={<Shop><CheckoutPage /></Shop>} />
          <Route path="/order/:token" element={<Shop><TrackPage /></Shop>} />
          <Route path="/staff/*" element={<StaffApp />} />
          <Route path="/display" element={<DisplayBoard />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ToastProvider>
    </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
);
