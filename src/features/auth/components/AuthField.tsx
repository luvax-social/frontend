import type { HTMLInputTypeAttribute, ReactNode } from 'react';
import type { UseFormRegisterReturn } from 'react-hook-form';
interface FieldProps {
  id: string;
  label: string;
  type?: HTMLInputTypeAttribute;
  autoComplete?: string;
  error?: string;
  register: UseFormRegisterReturn;
  rightSlot?: ReactNode;
  className?: string;
}

export default function Field({
  id,
  label,
  type,
  autoComplete,
  error,
  register,
  rightSlot,
  className = '',
}: FieldProps) {
  return (
    <div className="lx-fg">
      <div className={`lx-field ${className}`} data-error={error ? 'true' : 'false'}>
        <input id={id} type={type} placeholder={label} autoComplete={autoComplete} {...register} />
        <label htmlFor={id}>{label}</label>
        {rightSlot}
      </div>
      {error ? (
        <p className="lx-field-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
