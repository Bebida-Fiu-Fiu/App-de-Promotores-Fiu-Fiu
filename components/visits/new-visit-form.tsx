'use client';

import { CalendarDays } from 'lucide-react';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useFieldArray, useForm } from 'react-hook-form';

import { createVisit } from '@/lib/actions';

const productSuggestions = [
  'Cajazinha',
  'Abacaxi Cortelâ',
  'Tangerina c/ Acerola',
  'Pomar',
  'ICE Cajalemon',
  'ICE Chicletin',
  'ICE Limonada Rosa',
  'ICE Três Limões',
  'ICE Maracujá e Morango',
  'Licor Banoffe',
  'Licor Suspiro',
  'Licor Churros',
  'Licor Tortinha de Limão',
  'Licor Paçoca'
];

const packageOptions = ['unidade', 'pack', 'caixa'] as const;

type VisitFormValues = {
  establishment: string;
  date: string;
  products: {
    name: string;
    quantity: number;
    packageType: (typeof packageOptions)[number];
    expirationDate: string;
  }[];
};

function formatDateToDisplay(value: string) {
  if (!value) {
    return '';
  }

  const [year, month, day] = value.split('-');

  if (!year || !month || !day) {
    return value;
  }

  return `${day}/${month}/${year}`;
}

function ProductExpirationDateField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const expirationPickerRef = useRef<HTMLInputElement | null>(null);

  return (
    <div className="flex items-center gap-1">
      <input
        type="text"
        inputMode="numeric"
        placeholder="Val. dd/mm/aaaa"
        value={value}
        className="h-8 w-full rounded-md border border-[#707070] bg-white px-2 text-center text-sm outline-none"
        onChange={(event) => onChange(event.target.value)}
      />

      <button
        type="button"
        onClick={() => expirationPickerRef.current?.showPicker?.()}
        className="rounded-md border border-[#707070] bg-white p-2 text-[#2a2a2a] transition hover:bg-[#e9e9e4]"
        aria-label="Selecionar data de validade"
      >
        <CalendarDays size={14} />
      </button>

      <input
        ref={expirationPickerRef}
        type="date"
        className="sr-only"
        onChange={(event) => onChange(formatDateToDisplay(event.target.value))}
      />
    </div>
  );
}

export function NewVisitForm() {
  const router = useRouter();
  const visitDatePickerRef = useRef<HTMLInputElement | null>(null);
  const [modalMessage, setModalMessage] = useState<string | null>(null);
  const [modalMode, setModalMode] = useState<'success' | 'error' | null>(null);

  const { register, control, handleSubmit, setValue, watch, reset, formState: { isSubmitting } } = useForm<VisitFormValues>({
    defaultValues: {
      establishment: '',
      date: '',
      products: [
        {
          name: '',
          quantity: 0,
          packageType: 'unidade',
          expirationDate: '',
        },
      ],
    },
  });

  const visitDate = watch('date');

  const { fields, append } = useFieldArray({
    control,
    name: 'products',
  });

  const onSubmit = async (data: VisitFormValues) => {
    const result = await createVisit(data);

    if (!result.success) {
      setModalMode('error');
      setModalMessage(result.error ?? 'Nao foi possivel salvar a visita.');
      return;
    }

    reset({
      establishment: '',
      date: '',
      products: [
        {
          name: '',
          quantity: 0,
          packageType: 'unidade',
          expirationDate: '',
        },
      ],
    });

    setModalMode('success');
    setModalMessage('Visita cadastrada com sucesso.');
  };

  return (
    <section className="flex w-full justify-center px-4 pt-24 pb-10">
      {modalMessage && modalMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center text-[#2a2a2a] shadow-xl">
            <h2 className="text-xl font-bold">
              {modalMode === 'success' ? 'Visita salva' : 'Erro ao salvar'}
            </h2>
            <p className="mt-3 text-sm">{modalMessage}</p>
            <div className="mt-5 flex justify-center gap-3">
              {modalMode === 'success' && (
                <button
                  type="button"
                  onClick={() => {
                    setModalMessage(null);
                    setModalMode(null);
                    router.push('/');
                    router.refresh();
                  }}
                  className="rounded-md bg-[#009c6c] px-4 py-2 font-semibold text-white transition hover:bg-[#007a55]"
                >
                  Ir para home
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setModalMessage(null);
                  setModalMode(null);
                }}
                className="rounded-md border border-[#707070] bg-white px-4 py-2 text-sm transition hover:bg-[#f3f3ef]"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="w-full max-w-xs rounded-[1.25rem] border border-[#5b5b5b] bg-[#f4f4f1] px-3 py-6 text-[#2a2a2a] shadow-[0_12px_30px_rgba(0,0,0,0.08)]"
      >
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="block text-sm font-medium">Estabelecimento</label>
            <input
              type="text"
              placeholder="Digite o estabelecimento"
              className="h-8 w-full rounded-md border border-[#707070] bg-white px-3 text-center text-sm outline-none"
              {...register('establishment')}
            />
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium">Data</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                inputMode="numeric"
                placeholder="dd/mm/aaaa"
                value={visitDate}
                className="h-8 w-full rounded-md border border-[#707070] bg-white px-3 text-center text-sm outline-none"
                onChange={(event) =>
                  setValue('date', event.target.value, {
                    shouldDirty: true,
                    shouldTouch: true,
                  })
                }
              />

              <button
                type="button"
                onClick={() => visitDatePickerRef.current?.showPicker?.()}
                className="rounded-md border border-[#707070] bg-white p-2 text-[#2a2a2a] transition hover:bg-[#e9e9e4]"
                aria-label="Selecionar data da visita"
              >
                <CalendarDays size={16} />
              </button>

              <input
                ref={visitDatePickerRef}
                type="date"
                className="sr-only"
                onChange={(event) => {
                  setValue('date', formatDateToDisplay(event.target.value), {
                    shouldDirty: true,
                    shouldTouch: true,
                  });
                }}
              />
            </div>
          </div>
        </div>

        <div className="mt-7 space-y-3">
          {fields.map((field, productIndex) => (
            <div key={field.id} className="space-y-3 rounded-lg border border-[#cfcfc8] bg-[#efefe9] p-3">
              <div className="space-y-1">
                <label className="block text-sm font-medium">Produto</label>
                <input
                  list={`product-suggestions-${productIndex}`}
                  placeholder="Digite ou selecione um produto"
                  className="h-8 w-full rounded-md border border-[#707070] bg-white px-3 text-center text-sm outline-none"
                  {...register(`products.${productIndex}.name`)}
                />
              </div>

              <datalist id={`product-suggestions-${productIndex}`}>
                {productSuggestions.map((product) => (
                  <option key={product} value={product} />
                ))}
              </datalist>

              <div className="grid grid-cols-1 gap-3">
                <div className="space-y-1">
                  <label className="block text-sm font-medium">Quantidade</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="Qtd"
                    className="h-8 w-full rounded-md border border-[#707070] bg-white px-2 text-center text-sm outline-none"
                    {...register(`products.${productIndex}.quantity`, {
                      valueAsNumber: true,
                    })}
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-sm font-medium">Unidade de medida</label>
                  <select
                    className="h-8 w-full rounded-md border border-[#707070] bg-white px-2 text-sm outline-none"
                    {...register(`products.${productIndex}.packageType`)}
                  >
                    {packageOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-sm font-medium">Validade</label>
                  <ProductExpirationDateField
                    value={watch(`products.${productIndex}.expirationDate`)}
                    onChange={(value) =>
                      setValue(`products.${productIndex}.expirationDate`, value, {
                        shouldDirty: true,
                        shouldTouch: true,
                      })
                    }
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 flex justify-start">
          <button
            type="button"
            onClick={() =>
              append({
                name: '',
                quantity: 0,
                packageType: 'unidade',
                expirationDate: '',
              })
            }
            className="rounded-md border border-[#707070] bg-white px-3 py-1.5 text-sm text-[#2a2a2a] transition hover:bg-[#e9e9e4]"
          >
            + Adicionar produto
          </button>
        </div>

        <div className="mt-7 flex justify-end">
          <button
            type="submit"
            disabled={isSubmitting}
            className="min-w-28 rounded-md border border-[#707070] bg-white px-4 py-1.5 text-sm text-[#2a2a2a] transition hover:bg-[#e9e9e4]"
          >
            {isSubmitting ? 'Salvando...' : 'Enviar'}
          </button>
        </div>
      </form>
    </section>
  );
}
