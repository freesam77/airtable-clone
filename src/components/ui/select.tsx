"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "~/lib/utils";

interface SelectContextType {
  value: string;
  onValueChange: (value: string) => void;
}

const SelectContext = React.createContext<SelectContextType | null>(null);

const Select = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    value?: string;
    onValueChange?: (value: string) => void;
  }
>(({ children, value = "", onValueChange, ...props }, ref) => {
  return (
    <SelectContext.Provider value={{ value, onValueChange: onValueChange || (() => {}) }}>
      <div ref={ref} {...props}>
        {children}
      </div>
    </SelectContext.Provider>
  );
});

Select.displayName = "Select";

const SelectTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, children, ...props }, ref) => {
  const [open, setOpen] = React.useState(false);
  const context = React.useContext(SelectContext);

  return (
    <div className="relative">
      <button
        ref={ref}
        type="button"
        role="combobox"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className={cn(
          "flex h-10 w-full items-center justify-between rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      >
        {children}
        <ChevronDown className="h-4 w-4 opacity-50" />
      </button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute top-full z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-gray-300 bg-white py-1 shadow-lg">
            <SelectContent onClose={() => setOpen(false)}>
              {React.Children.map(children, (child) => {
                if (React.isValidElement(child) && child.type === SelectContent) {
                  return React.cloneElement(child as React.ReactElement<any>, { onClose: () => setOpen(false) });
                }
                return null;
              })}
            </SelectContent>
          </div>
        </>
      )}
    </div>
  );
});

SelectTrigger.displayName = "SelectTrigger";

const SelectValue = React.forwardRef<
  HTMLSpanElement,
  React.HTMLAttributes<HTMLSpanElement> & {
    placeholder?: string;
  }
>(({ className, placeholder, ...props }, ref) => {
  const context = React.useContext(SelectContext);
  
  return (
    <span ref={ref} className={cn("block truncate", className)} {...props}>
      {context?.value || placeholder}
    </span>
  );
});

SelectValue.displayName = "SelectValue";

const SelectContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    onClose?: () => void;
  }
>(({ className, children, onClose, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn("py-1", className)}
      {...props}
    >
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child) && child.type === SelectItem) {
          return React.cloneElement(child as React.ReactElement<any>, { onClose });
        }
        return child;
      })}
    </div>
  );
});

SelectContent.displayName = "SelectContent";

const SelectItem = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    value: string;
    onClose?: () => void;
  }
>(({ className, children, value, onClose, ...props }, ref) => {
  const context = React.useContext(SelectContext);
  
  const handleClick = () => {
    context?.onValueChange(value);
    onClose?.();
  };

  return (
    <div
      ref={ref}
      role="option"
      onClick={handleClick}
      className={cn(
        "relative cursor-pointer select-none py-2 px-3 text-sm hover:bg-gray-100 focus:bg-gray-100 focus:outline-none",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
});

SelectItem.displayName = "SelectItem";

export {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
};