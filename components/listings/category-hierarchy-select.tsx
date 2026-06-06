"use client"

import { useMemo } from "react"
import type { Category } from "@/lib/types"
import { useLanguage } from "@/lib/i18n/language-context"
import Select, { components } from "react-select"

interface CategoryHierarchySelectProps {
  categories: Category[]
  value: string
  onChange: (value: string) => void
  id?: string
  className?: string
  placeholder?: string
}

interface FlatCategory {
  value: string
  label: string
  level: number
}

interface CategoryNode extends Category {
  children: CategoryNode[]
}

export function CategoryHierarchySelect({
  categories,
  value,
  onChange,
  id = "category",
  className,
  placeholder,
}: CategoryHierarchySelectProps) {
  const { t, tCategory } = useLanguage()

  const flatCategories = useMemo<FlatCategory[]>(() => {
    const nodes = new Map<string, CategoryNode>()

    for (const category of categories) {
      nodes.set(category.id, { ...category, children: [] })
    }

    const roots: CategoryNode[] = []

    for (const category of categories) {
      const node = nodes.get(category.id)
      if (!node) continue

      if (category.parent_id && nodes.has(category.parent_id)) {
        nodes.get(category.parent_id)?.children.push(node)
      } else {
        roots.push(node)
      }
    }

    const sortNodes = (items: CategoryNode[]) => {
      items.sort((a, b) => a.name.localeCompare(b.name, "it", { sensitivity: "base" }))
      items.forEach((item) => sortNodes(item.children))
    }

    sortNodes(roots)

    const out: FlatCategory[] = []

    const visit = (items: CategoryNode[], depth: number) => {
      for (const item of items) {
        out.push({
          value: item.id,
          label: tCategory(item.id, item.name),
          level: depth,
        })

        if (item.children.length > 0) {
          visit(item.children, depth + 1)
        }
      }
    }

    visit(roots, 0)
    return out
  }, [categories, tCategory])

  const selectedOption = flatCategories.find((cat) => cat.value === value) || null

  return (
    <div className={className}>
      <Select<FlatCategory, false>
        instanceId={`${id}-instance`}
        inputId={id}
        name={id}
        options={flatCategories}
        value={selectedOption}
        onChange={(option) => onChange(option?.value || "")}
        isClearable
        placeholder={placeholder || t("listing.new.fields.category_placeholder")}
        noOptionsMessage={() => t("listing.new.category.no_options")}
        unstyled
        components={{
          Option: ({ children, ...props }) => (
            <components.Option {...props}>
              <div style={{ paddingLeft: `${props.data.level * 16}px` }} className="flex items-center gap-2">
                {props.data.level > 0 ? <span className="text-muted-foreground/60">└</span> : null}
                <span>{children}</span>
              </div>
            </components.Option>
          ),
        }}
        classNames={{
          control: (state) =>
            `w-full rounded-lg border bg-background px-1 py-1 text-foreground transition ${
              state.isFocused
                ? "border-primary ring-2 ring-primary/20"
                : "border-input"
            }`,
          valueContainer: () => "px-2 py-1",
          input: () => "m-0 p-0 text-sm",
          placeholder: () => "text-muted-foreground text-sm",
          singleValue: () => "text-foreground text-sm",
          indicatorsContainer: () => "text-muted-foreground",
          clearIndicator: () => "p-1 hover:text-foreground",
          dropdownIndicator: () => "p-1 hover:text-foreground",
          menu: () => "mt-1 rounded-lg border border-border bg-card shadow-lg overflow-hidden z-50",
          menuList: () => "max-h-64 overflow-auto p-1",
          option: (state) =>
            `cursor-pointer rounded-md px-3 py-2 text-sm ${
              state.isSelected
                ? "bg-primary text-primary-foreground"
                : state.isFocused
                  ? "bg-muted text-foreground"
                  : "text-foreground"
            }`,
          noOptionsMessage: () => "px-3 py-2 text-sm text-muted-foreground",
        }}
      />
    </div>
  )
}

