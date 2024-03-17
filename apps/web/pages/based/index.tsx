import type { AvailabilityFormValues } from "@pages/availability/[schedule]";
import { AvailabilityForm } from "@pages/availability/[schedule]";
import { useBased, type ExposedComponent, type ExposedFunction } from "@pages/based/based.js/Based";
import { SocketProvider } from "@pages/based/based.js/BasedSocketContext";
import type {
  ComponentMessage,
  FunctionMessage,
  TextMessage,
} from "@pages/based/based.js/BasedThreadContext";
import { useEffect } from "react";
import { Responsive, WidthProvider } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import { useForm } from "react-hook-form";
import "react-resizable/css/styles.css";

import type { Dayjs } from "@calcom/dayjs";
import dayjs from "@calcom/dayjs";
import { useFilterQuery } from "@calcom/features/bookings/lib/useFilterQuery";
import { BookingStatusLineChart } from "@calcom/features/insights/components";
import { FiltersProvider } from "@calcom/features/insights/context/FiltersProvider";
import { Filters } from "@calcom/features/insights/filters";
import Shell from "@calcom/features/shell/Shell";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { HttpError } from "@calcom/lib/http-error";
import { trpc } from "@calcom/trpc/react";
import { Button, showToast } from "@calcom/ui";

import useMeQuery from "@lib/hooks/useMeQuery";

import PageWrapper from "@components/PageWrapper";

import { BookingsList } from "~/bookings/views/bookings-listing-view";

const ResponsiveGridLayout = WidthProvider(Responsive);

function Main() {
  const { thread, generateUI } = useBased(
    "You are a helpful assistant for Cal.com, an open-source alternative for Calendly, which purpose is to help users to use the platform in an easy way.\n\nTo reschedule bookings use the Reschedule Bookings component",
    availableComponents,
    availableFunctions
  );

  console.log("\n== thread ==\n", thread, "\n");

  const layouts = {
    lg: [],
    md: [],
    sm: [],
    xs: [],
    xxs: [],
  };

  if (thread && thread.messages && thread.messages.length) {
    Object.keys(layouts).forEach((breakpoint) => {
      layouts[breakpoint] =
        thread && thread.messages
          ? thread.messages
              .filter(({ role }) => role === "component")
              .map((message, index) => {
                const component = availableComponents.find((comp) => comp.name === message.content.name);
                return {
                  i: `based-component-${index}`,
                  x: 0,
                  y: Infinity,
                  w:
                    component && component.extraData.width[breakpoint]
                      ? component.extraData.width[breakpoint]
                      : 20,
                  h: component && component.extraData.height ? component.extraData.height : 5,
                  static: false,
                };
              })
          : [];
    });
  }

  return (
    <div>
      <Shell
        heading="Based"
        title="Based"
        description="Use Based to do this thing easy to use."
        hideHeadingOnMobile
        withoutMain={false}
        subtitle="Use Based to do this thing easy to use."
        CTA={
          <Button
            onClick={() =>
              generateUI(
                !thread || !thread.messages
                  ? "Reschedule all Friday Bookings. Please explain that I catch the flu and I will not be able to make it :,c"
                  : "Show me the insights please <3!"
              )
            }>
            {!thread || !thread.messages ? "Reschedule Friday Bookings" : "Load Insights"}
          </Button>
        }>
        <ResponsiveGridLayout
          breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
          cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
          layouts={layouts}
          rowHeight={30}
          resizable={true}>
          {thread &&
            thread.messages &&
            thread.messages
              .filter(({ role }) => role === "component")
              .map((message: ComponentMessage | FunctionMessage | TextMessage, index: number) => (
                <div
                  className="mt-2 overflow-hidden border-2 border-slate-400 p-2 px-2 pt-2"
                  key={`based-component-${index}`}>
                  <div className="h-full overflow-auto">
                    {message.role === "component" ? message.content.element : null}
                  </div>
                </div>
              ))}
        </ResponsiveGridLayout>
        {/* <RescheduleComponent day={dayjs()} /> */}
      </Shell>
    </div>
  );
}

export default function BasedPage() {
  return (
    <SocketProvider token="testToken">
      <Main />
    </SocketProvider>
  );
}

BasedPage.PageWrapper = PageWrapper;

const InsightsBasedElement = () => {
  const { t } = useLocale();

  const user = useMeQuery().data;

  if (!user) {
    return <></>;
  }

  return (
    <FiltersProvider>
      <Filters />

      <div className="mb-4 space-y-4">
        {/* <BookingKPICards /> */}

        <BookingStatusLineChart />

        {/* <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <PopularEventsTable />

          <AverageEventDurationChart />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <MostBookedTeamMembersTable />
          <LeastBookedTeamMembersTable />
        </div>
        <small className="text-default block text-center">
          {t("looking_for_more_insights")}{" "}
          <a
            className="text-blue-500 hover:underline"
            href="mailto:updates@cal.com?subject=Feature%20Request%3A%20More%20Analytics&body=Hey%20Cal.com%20Team%2C%20I%20love%20the%20analytics%20page%20but%20I%20am%20looking%20for%20...">
            {" "}
            {t("contact_support")}
          </a>
        </small> */}
      </div>
    </FiltersProvider>
  );
};

const RescheduleComponent = ({ day, reason }: { day: Dayjs; reason: string }) => {
  const { data: filterQuery } = useFilterQuery();
  const { t } = useLocale();
  const utils = trpc.useUtils();
  const me = useMeQuery();
  const scheduleId = 27;
  const { data: schedule, isPending } = trpc.viewer.availability.schedule.get.useQuery(
    { scheduleId },
    {
      enabled: !!scheduleId,
    }
  );

  const form = useForm<AvailabilityFormValues>({
    values: schedule && {
      ...schedule,
      schedule: schedule?.availability || [],
    },
  });
  const updateMutation = trpc.viewer.availability.schedule.update.useMutation({
    onSuccess: async ({ prevDefaultId, currentDefaultId, ...data }) => {
      if (prevDefaultId && currentDefaultId) {
        // check weather the default schedule has been changed by comparing  previous default schedule id and current default schedule id.
        if (prevDefaultId !== currentDefaultId) {
          // if not equal, invalidate previous default schedule id and refetch previous default schedule id.
          utils.viewer.availability.schedule.get.invalidate({ scheduleId: prevDefaultId });
          utils.viewer.availability.schedule.get.refetch({ scheduleId: prevDefaultId });
        }
      }
      utils.viewer.availability.schedule.get.invalidate({ scheduleId: data.schedule.id });
      utils.viewer.availability.list.invalidate();
      showToast(
        t("availability_updated_successfully", {
          scheduleName: data.schedule.name,
        }),
        "success"
      );
    },
    onError: (err) => {
      if (err instanceof HttpError) {
        const message = `${err.statusCode}: ${err.message}`;
        showToast(message, "error");
      }
    },
  });

  const query = trpc.viewer.bookings.get.useInfiniteQuery(
    {
      limit: 100,
      filters: {
        ...filterQuery,
        status: "upcoming",
      },
    },
    {
      enabled: true,
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    }
  );

  const { mutate: rescheduleApi, isPending: isReschedulePending } =
    trpc.viewer.bookings.requestReschedule.useMutation({
      async onSuccess() {
        await utils.viewer.bookings.invalidate();
        showToast("Reschedule requests sent!", "success");
      },
      onError() {
        // @TODO: notify sentry
      },
    });

  useEffect(() => {
    if (day && !isReschedulePending) {
      const startOfDay = day.utc().startOf("day");
      const endOfDay = day.utc().endOf("day");

      // Reschedule bookings
      if (query.data && query.data?.pages) {
        for (let i = 0; i < query.data?.pages.length; i++) {
          const page = query.data?.pages[i];
          page.bookings.map(
            (booking: {
              startTime: string | number | Date | Dayjs | null | undefined;
              title: string;
              uid: string;
            }) => {
              const bookingDate = dayjs(booking.startTime);
              if (bookingDate.isBetween(startOfDay, endOfDay, null, "[]")) {
                rescheduleApi({
                  bookingId: booking.uid,
                  rescheduleReason: reason || "",
                });
              }
            }
          );
        }
      }
    }
  }, [day, query.data, rescheduleApi, isReschedulePending, reason]);

  useEffect(() => {
    // If !isPending is true schedule is not undefined, but this helps TypeScript to know it too!
    if (!isPending && schedule) {
      const endOfDay = day.utc().endOf("day");

      const overrides = [
        ...schedule.dateOverrides,
        {
          ranges: [
            {
              start: endOfDay.toDate(),
              end: endOfDay.toDate(),
            },
          ],
        },
      ];

      // Lock availability
      updateMutation.mutate({
        scheduleId,
        dateOverrides: overrides.flatMap((override) => override.ranges),
        name: schedule.name,
        schedule: schedule.availability || [],
        timeZone: schedule.timeZone,
        isDefault: schedule.isDefault,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day, isPending]);

  return (
    <div className="flex gap-4">
      <AvailabilityForm
        updateMutation={updateMutation}
        form={form}
        scheduleId={scheduleId}
        me={me}
        schedule={schedule}
      />
    </div>
  );
};

const availableComponents: ExposedComponent[] = [
  {
    name: "Bookings list",
    description: "Display the list of upcoming booked events of the user",
    element: BookingsList,
    extraData: {
      height: 5,
      width: { lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 },
    },
  },
  {
    name: "Insights",
    description: "View booking insights across your events",
    element: InsightsBasedElement,
    extraData: {
      height: 14,
      width: { lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 },
    },
  },
  {
    name: "Reschedule Bookings",
    description:
      "When loaded this component automatically reschedule all the Bookings from a given day and disables the availability of the user for that day. Then it displays UI that shows the user that their availability has been blocked to provide a visual feedback of the operation.",
    element: RescheduleComponent,
    props: {
      day: {
        type: "string",
        description: "Day where all the bookings must be rescheduled",
        required: true,
        enum: ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"],
      },
      reason: {
        type: "string",
        description: "Reason for the reschedule (if not specified just say: `I'll explain you later.`)",
        required: true,
      },
    },
    loader: ({ day, reason }) => {
      const now = dayjs();
      const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
      const targetWeekday = days.indexOf(day.toLowerCase());

      let daysToAdd = targetWeekday - now.weekday();
      if (daysToAdd <= 0) {
        daysToAdd += 7;
      }

      const nextTargetDay = now.add(daysToAdd, "day");

      return {
        day: nextTargetDay,
        reason,
      };
    },
    extraData: {
      height: 18,
      width: { lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 },
    },
  },
];

const availableFunctions: ExposedFunction[] = [];
