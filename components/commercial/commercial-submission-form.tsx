'use client';

import { useId, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { createCommercialSubmission, updateCommercialSubmission } from '@/lib/actions';

function formatCurrencyInput(value: string) {
  const digits = value.replace(/\D/g, '');
  const amount = Number(digits || '0') / 100;

  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function parseCurrencyToNumber(value: string) {
  const normalized = value.replace(/\s/g, '').replace('R$', '').replace(/\./g, '').replace(',', '.');
  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function formatPhoneInput(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 11);

  if (digits.length === 0) {
    return '';
  }

  if (digits.length <= 2) {
    return `(${digits}`;
  }

  if (digits.length <= 3) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  }

  if (digits.length <= 7) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 3)} ${digits.slice(3)}`;
  }

  return `(${digits.slice(0, 2)}) ${digits.slice(2, 3)} ${digits.slice(3, 7)}-${digits.slice(7)}`;
}

function formatDateInput(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 8);

  if (digits.length <= 2) {
    return digits;
  }

  if (digits.length <= 4) {
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  }

  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function isValidDisplayDate(value: string) {
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
    return false;
  }

  const [day, month, year] = value.split('/').map(Number);

  if (!day || !month || !year) {
    return false;
  }

  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function parseDisplayDateToIso(value: string) {
  if (!isValidDisplayDate(value)) {
    return '';
  }

  const [day, month, year] = value.split('/');
  return `${year}-${month}-${day}`;
}

function formatIsoDateToDisplay(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return '';
  }

  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}

function isBlank(value: string) {
  return value.trim().length === 0;
}

const commercialSubmissionFormSchema = z.object({
  clientName: z.string().trim().min(1, 'Informe o cliente.'),
  fantasyName: z.string().trim().min(1, 'Informe a fantasia.'),
  cnpj: z
    .string()
    .trim()
    .refine((value) => isBlank(value) || value.replace(/\D/g, '').length === 14, 'Informe um CNPJ valido.'),
  email: z
    .string()
    .trim()
    .refine((value) => isBlank(value) || z.email().safeParse(value).success, 'Informe um email valido.'),
  phone: z
    .string()
    .trim()
    .min(1, 'Informe o telefone.')
    .refine((value) => value.replace(/\D/g, '').length === 11, 'Informe um telefone valido.'),
  address: z.string().trim().min(1, 'Informe o endereco.'),
  value: z
    .string()
    .trim()
    .min(1, 'Informe o valor.')
    .refine((value) => Number.isFinite(parseCurrencyToNumber(value)), 'Informe um valor valido.'),
  salesQuantity: z.coerce
    .number({ message: 'Informe a quantidade de vendas.' })
    .int('Informe um numero inteiro.')
    .min(0, 'Informe uma quantidade valida.'),
  sold: z.boolean(),
  visitDates: z
    .array(
      z.object({
        value: z
          .string()
          .trim()
          .min(1, 'Informe a data da visita.')
          .refine((value) => /^\d{2}\/\d{2}\/\d{4}$/.test(value), 'Use o formato dd/mm/aaaa.')
          .refine((value) => isValidDisplayDate(value), 'Informe uma data valida.'),
      })
    )
    .min(1, 'Informe pelo menos uma data de visita.'),
});

type CommercialSubmissionFormInput = z.input<typeof commercialSubmissionFormSchema>;
type CommercialSubmissionFormData = z.output<typeof commercialSubmissionFormSchema>;

type CommercialFormMode = 'create' | 'edit';

type CommercialSubmissionFormProps = {
  mode?: CommercialFormMode;
  submissionId?: number;
  initialValues?: Partial<CommercialSubmissionFormInput>;
};

const inputClassName =
  'mt-2 block w-full rounded-2xl border border-white/12 bg-white px-4 py-3 text-gray-900 shadow-sm outline-none transition focus:border-[#009c6c] focus:ring-4 focus:ring-[#009c6c]/15';

function getFormCopy(mode: CommercialFormMode) {
  if (mode === 'edit') {
    return {
      eyebrow: 'Editar cliente',
      title: 'Atualizar cadastro do comercial',
      description: 'Revise os dados do cliente e mantenha o historico de visitas atualizado.',
      submitLabel: 'Salvar alteracoes',
      submittingLabel: 'Salvando alteracoes...',
      successLabel: 'Cadastro atualizado com sucesso.',
    };
  }

  return {
    eyebrow: 'Comercial',
    title: 'Novo cadastro de cliente',
    description: 'Preencha os dados abaixo para registrar um novo cliente do comercial.',
    submitLabel: 'Salvar cadastro',
    submittingLabel: 'Salvando cadastro...',
    successLabel: 'Cadastro salvo com sucesso.',
  };
}

export function CommercialSubmissionForm({
  mode = 'create',
  submissionId,
  initialValues,
}: CommercialSubmissionFormProps) {
  // useId é igual no servidor e no navegador; field.id (useFieldArray) é aleatório
  // e causava erro de hidratação no id do seletor de data.
  const formId = useId();
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const copy = getFormCopy(mode);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<CommercialSubmissionFormInput, unknown, CommercialSubmissionFormData>({
    resolver: zodResolver(commercialSubmissionFormSchema),
    defaultValues: {
      clientName: initialValues?.clientName ?? '',
      fantasyName: initialValues?.fantasyName ?? '',
      cnpj: initialValues?.cnpj ?? '',
      email: initialValues?.email ?? '',
      phone: initialValues?.phone ?? '',
      address: initialValues?.address ?? '',
      value: initialValues?.value ?? formatCurrencyInput('0'),
      salesQuantity: initialValues?.salesQuantity ?? 0,
      sold: initialValues?.sold ?? false,
      visitDates:
        initialValues?.visitDates && initialValues.visitDates.length > 0
          ? initialValues.visitDates
          : [{ value: '' }],
    },
  });

  const { fields: visitDateFields, append, remove } = useFieldArray({
    control,
    name: 'visitDates',
  });
  const watchedVisitDates = useWatch({
    control,
    name: 'visitDates',
  });

  const valueField = register('value');
  const phoneField = register('phone');

  const onSubmit = async (data: CommercialSubmissionFormData) => {
    setServerError(null);
    setSuccessMessage(null);

    const payload = {
      ...data,
      value: parseCurrencyToNumber(data.value),
      visitDates: data.visitDates.map((visitDate) => visitDate.value),
    };

    const result =
      mode === 'create' || !submissionId
        ? await createCommercialSubmission(payload)
        : await updateCommercialSubmission({
            submissionId,
            ...payload,
          });

    if (!result.success) {
      setServerError(result.error ?? 'Nao foi possivel salvar o formulario.');
      return;
    }

    setSuccessMessage(copy.successLabel);

    if (mode === 'create') {
      reset({
        clientName: '',
        fantasyName: '',
        cnpj: '',
        email: '',
        phone: '',
        address: '',
        value: formatCurrencyInput('0'),
        salesQuantity: 0,
        sold: false,
        visitDates: [{ value: '' }],
      });
    }

    const nextId = result.submissionId ?? submissionId;

    if (nextId) {
      router.push(`/comercial/${nextId}`);
      router.refresh();
    }
  };

  return (
    <section className="mx-auto w-full max-w-4xl px-4 pb-12 pt-24">
      <div className="rounded-[2rem] border border-white/10 bg-white/6 p-6 shadow-2xl shadow-black/20 backdrop-blur md:p-8">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#7fe7c5]">
            {copy.eyebrow}
          </p>
          <h1 className="mt-3 text-3xl font-black text-white">{copy.title}</h1>
          <p className="mt-3 text-sm leading-6 text-white/72">{copy.description}</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-6">
          {serverError && (
            <div className="rounded-2xl border border-red-300/35 bg-red-500/10 px-4 py-3 text-sm text-red-100">
              {serverError}
            </div>
          )}

          {successMessage && (
            <div className="rounded-2xl border border-emerald-300/35 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
              {successMessage}
            </div>
          )}

          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label htmlFor="clientName" className="text-sm font-semibold text-white">
                Cliente
              </label>
              <input id="clientName" className={inputClassName} {...register('clientName')} />
              {errors.clientName && (
                <p className="mt-2 text-sm text-red-200">{errors.clientName.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="fantasyName" className="text-sm font-semibold text-white">
                Fantasia
              </label>
              <input id="fantasyName" className={inputClassName} {...register('fantasyName')} />
              {errors.fantasyName && (
                <p className="mt-2 text-sm text-red-200">{errors.fantasyName.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="cnpj" className="text-sm font-semibold text-white">
                CNPJ
              </label>
              <input id="cnpj" className={inputClassName} {...register('cnpj')} />
              {errors.cnpj && <p className="mt-2 text-sm text-red-200">{errors.cnpj.message}</p>}
            </div>

            <div>
              <label htmlFor="email" className="text-sm font-semibold text-white">
                Email
              </label>
              <input id="email" type="email" className={inputClassName} {...register('email')} />
              {errors.email && <p className="mt-2 text-sm text-red-200">{errors.email.message}</p>}
            </div>

            <div>
              <label htmlFor="phone" className="text-sm font-semibold text-white">
                Telefone
              </label>
              <input
                id="phone"
                type="text"
                inputMode="numeric"
                className={inputClassName}
                {...phoneField}
                onChange={(event) => {
                  phoneField.onChange(event);
                  setValue('phone', formatPhoneInput(event.target.value), {
                    shouldDirty: true,
                    shouldValidate: true,
                  });
                }}
              />
              {errors.phone && <p className="mt-2 text-sm text-red-200">{errors.phone.message}</p>}
            </div>

            <div>
              <label htmlFor="address" className="text-sm font-semibold text-white">
                Endereco
              </label>
              <input id="address" className={inputClassName} {...register('address')} />
              {errors.address && (
                <p className="mt-2 text-sm text-red-200">{errors.address.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="value" className="text-sm font-semibold text-white">
                Valor
              </label>
              <input
                id="value"
                type="text"
                inputMode="numeric"
                className={inputClassName}
                {...valueField}
                onChange={(event) => {
                  valueField.onChange(event);
                  setValue('value', formatCurrencyInput(event.target.value), {
                    shouldDirty: true,
                    shouldValidate: true,
                  });
                }}
              />
              {errors.value && <p className="mt-2 text-sm text-red-200">{errors.value.message}</p>}
            </div>

            <div>
              <label htmlFor="salesQuantity" className="text-sm font-semibold text-white">
                Qtd Vendas
              </label>
              <input
                id="salesQuantity"
                type="number"
                step="1"
                min="0"
                className={inputClassName}
                {...register('salesQuantity', { valueAsNumber: true })}
              />
              {errors.salesQuantity && (
                <p className="mt-2 text-sm text-red-200">{errors.salesQuantity.message}</p>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <label className="text-sm font-semibold text-white">Datas das visitas</label>
                <p className="mt-1 text-xs text-white/65">
                  Adicione quantas datas forem necessarias para esse cliente.
                </p>
              </div>

              <button
                type="button"
                onClick={() => append({ value: '' })}
                className="rounded-full border border-white/15 px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/10"
              >
                Adicionar data
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {visitDateFields.map((field, index) => {
                const visitDateField = register(`visitDates.${index}.value`);
                const calendarInputId = `${formId}-visit-date-calendar-${index}`;
                const currentVisitDateValue = watchedVisitDates?.[index]?.value ?? '';

                return (
                  <div key={field.id} className="flex items-center gap-3">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="dd/mm/aaaa"
                        className={`${inputClassName} mt-0 pr-14`}
                        {...visitDateField}
                        onChange={(event) => {
                          visitDateField.onChange(event);
                          setValue(`visitDates.${index}.value`, formatDateInput(event.target.value), {
                            shouldDirty: true,
                            shouldValidate: true,
                          });
                        }}
                        onBlur={(event) => {
                          visitDateField.onBlur(event);
                          setValue(`visitDates.${index}.value`, formatDateInput(event.target.value), {
                            shouldDirty: true,
                            shouldValidate: true,
                          });
                        }}
                      />

                      <input
                        id={calendarInputId}
                        type="date"
                        tabIndex={-1}
                        className="pointer-events-none absolute right-12 top-1/2 h-0 w-0 opacity-0"
                        value={parseDisplayDateToIso(currentVisitDateValue ?? '')}
                        onChange={(event) => {
                          setValue(
                            `visitDates.${index}.value`,
                            formatIsoDateToDisplay(event.target.value),
                            {
                              shouldDirty: true,
                              shouldValidate: true,
                            }
                          );
                        }}
                      />

                      <button
                        type="button"
                        onClick={() => {
                          const calendarInput = document.getElementById(calendarInputId) as HTMLInputElement | null;

                          if (!calendarInput) {
                            return;
                          }

                          if (typeof calendarInput.showPicker === 'function') {
                            calendarInput.showPicker();
                            return;
                          }

                          calendarInput.click();
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-2 text-[#0f2d3d] transition hover:bg-[#0f2d3d]/8"
                        aria-label={`Abrir calendario da data ${index + 1}`}
                      >
                        <CalendarDays size={18} />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => remove(index)}
                      disabled={visitDateFields.length === 1}
                      className="rounded-full border border-red-300/20 px-4 py-3 text-xs font-semibold text-red-100 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      Remover
                    </button>
                  </div>
                );
              })}
            </div>

            {errors.visitDates?.root?.message && (
              <p className="mt-3 text-sm text-red-200">{errors.visitDates.root.message}</p>
            )}

            {Array.isArray(errors.visitDates) &&
              errors.visitDates.map((error, index) => {
                if (!error?.value?.message) {
                  return null;
                }

                return (
                  <p key={index} className="mt-3 text-sm text-red-200">
                    Data {index + 1}: {error.value.message}
                  </p>
                );
              })}
          </div>

          <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-white">
            <input type="checkbox" className="h-4 w-4 accent-[#009c6c]" {...register('sold')} />
            Vendido
          </label>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-full bg-[#009c6c] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#00805a] disabled:cursor-not-allowed disabled:bg-[#5c6b72]"
            >
              {isSubmitting ? copy.submittingLabel : copy.submitLabel}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
