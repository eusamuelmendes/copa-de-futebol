"""Funções auxiliares de leitura e validação de entrada do usuário no CLI."""

from datetime import datetime
from typing import Callable, Sequence, TypeVar

T = TypeVar("T")


def ler_texto(prompt: str, obrigatorio: bool = True) -> str:
    while True:
        valor = input(prompt).strip()
        if valor or not obrigatorio:
            return valor
        print("  > Este campo é obrigatório.")


def ler_inteiro(
    prompt: str,
    minimo: int | None = None,
    maximo: int | None = None,
    obrigatorio: bool = True,
    padrao: int | None = None,
) -> int | None:
    while True:
        bruto = input(prompt).strip()
        if not bruto:
            if padrao is not None:
                return padrao
            if not obrigatorio:
                return None
            print("  > Este campo é obrigatório.")
            continue
        try:
            valor = int(bruto)
        except ValueError:
            print("  > Digite um número inteiro válido.")
            continue
        if minimo is not None and valor < minimo:
            print(f"  > O valor mínimo é {minimo}.")
            continue
        if maximo is not None and valor > maximo:
            print(f"  > O valor máximo é {maximo}.")
            continue
        return valor


def ler_data(prompt: str = "Data (AAAA-MM-DD): ") -> str:
    while True:
        bruto = input(prompt).strip()
        try:
            data = datetime.strptime(bruto, "%Y-%m-%d")
            return data.strftime("%Y-%m-%d")
        except ValueError:
            print("  > Data inválida. Use o formato AAAA-MM-DD, ex: 2026-06-15.")


def ler_horario(prompt: str = "Horário (HH:MM): ") -> str:
    while True:
        bruto = input(prompt).strip()
        try:
            hora = datetime.strptime(bruto, "%H:%M")
            return hora.strftime("%H:%M")
        except ValueError:
            print("  > Horário inválido. Use o formato HH:MM, ex: 16:00.")


def ler_opcao(prompt: str, opcoes: Sequence[str], obrigatorio: bool = True) -> str:
    opcoes_lower = {o.lower(): o for o in opcoes}
    while True:
        bruto = input(f"{prompt} ({'/'.join(opcoes)}): ").strip().lower()
        if not bruto and not obrigatorio:
            return ""
        if bruto in opcoes_lower:
            return opcoes_lower[bruto]
        print(f"  > Opção inválida. Escolha entre: {', '.join(opcoes)}.")


def confirmar(prompt: str) -> bool:
    while True:
        bruto = input(f"{prompt} (s/n): ").strip().lower()
        if bruto in ("s", "sim"):
            return True
        if bruto in ("n", "nao", "não"):
            return False
        print("  > Responda com 's' ou 'n'.")


def escolher_da_lista(
    itens: Sequence[T],
    formatar: Callable[[T], str],
    prompt: str = "Escolha uma opção",
    permitir_cancelar: bool = True,
) -> T | None:
    if not itens:
        print("  > Nenhum item disponível.")
        return None
    for i, item in enumerate(itens, start=1):
        print(f"  [{i}] {formatar(item)}")
    if permitir_cancelar:
        print("  [0] Cancelar")
    while True:
        escolha = ler_inteiro(f"{prompt}: ", minimo=0 if permitir_cancelar else 1, maximo=len(itens))
        if escolha == 0 and permitir_cancelar:
            return None
        if escolha:
            return itens[escolha - 1]
