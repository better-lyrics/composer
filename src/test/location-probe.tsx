import { useLocation } from "react-router-dom";

// -- Component ----------------------------------------------------------------

const LocationProbe: React.FC = () => {
  const location = useLocation();
  return <output aria-label="Current path">{location.pathname}</output>;
};

// -- Exports ------------------------------------------------------------------

export { LocationProbe };
