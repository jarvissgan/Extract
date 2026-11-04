import { ActionIcon, Group, Title } from "@mantine/core";
import { MonthPickerInput } from "@mantine/dates";
import { IconCalendar, IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import dayjs, { type Dayjs } from "dayjs";
import { useIsMobile } from "../hooks/useIsMobile";

interface Props {
  title: string;
  month: Dayjs;
  onMonthChange: (value: string | null) => void;
}

// Page title with a month picker and previous/next arrows; future months can't be picked.
// On phones the picker takes the full width under the title.
const MonthHeader = ({ title, month, onMonthChange }: Props) => {
  const isMobile = useIsMobile();
  const isCurrent = month.isSame(dayjs(), "month");
  const go = (delta: number) => onMonthChange(month.add(delta, "month").format("YYYY-MM-DD"));

  return (
    <Group justify="space-between" align="flex-end" gap="sm">
      <Title order={2} style={{ flex: isMobile ? "1 1 100%" : undefined }}>
        {title}
      </Title>
      <Group gap={6} wrap="nowrap" w={{ base: "100%", sm: "auto" }}>
        <ActionIcon variant="default" size={36} onClick={() => go(-1)} aria-label="Previous month">
          <IconChevronLeft size={18} />
        </ActionIcon>
        <MonthPickerInput
          aria-label="Month"
          leftSection={<IconCalendar size={16} />}
          value={month.format("YYYY-MM-DD")}
          onChange={onMonthChange}
          maxDate={dayjs().endOf("month").format("YYYY-MM-DD")}
          valueFormat="MMMM YYYY"
          dropdownType={isMobile ? "modal" : "popover"}
          style={{ flex: 1 }}
          w={{ base: "auto", sm: 190 }}
        />
        <ActionIcon variant="default" size={36} onClick={() => go(1)} disabled={isCurrent} aria-label="Next month">
          <IconChevronRight size={18} />
        </ActionIcon>
      </Group>
    </Group>
  );
};

export default MonthHeader;
