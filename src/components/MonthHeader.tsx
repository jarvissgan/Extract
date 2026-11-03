import { Group, Title } from "@mantine/core";
import { MonthPickerInput } from "@mantine/dates";
import { IconCalendar } from "@tabler/icons-react";
import dayjs, { type Dayjs } from "dayjs";

interface Props {
  title: string;
  month: Dayjs;
  onMonthChange: (value: string | null) => void;
}

// Page title with a month picker; future months can't be picked.
const MonthHeader = ({ title, month, onMonthChange }: Props) => (
  <Group justify="space-between" align="flex-end">
    <Title order={2}>{title}</Title>
    <MonthPickerInput
      aria-label="Month"
      leftSection={<IconCalendar size={16} />}
      value={month.format("YYYY-MM-DD")}
      onChange={onMonthChange}
      maxDate={dayjs().endOf("month").format("YYYY-MM-DD")}
      valueFormat="MMMM YYYY"
      w={200}
    />
  </Group>
);

export default MonthHeader;
