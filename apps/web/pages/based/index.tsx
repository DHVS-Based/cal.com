import { zodResolver } from "@hookform/resolvers/zod";
import type { AvailabilityFormValues } from "@pages/availability/[schedule]";
import { AvailabilityForm } from "@pages/availability/[schedule]";
import { useBased, type ExposedComponent, type ExposedFunction } from "@pages/based/based.js/Based";
import { SocketProvider } from "@pages/based/based.js/BasedSocketContext";
import type {
  ComponentMessage,
  FunctionMessage,
  TextMessage,
} from "@pages/based/based.js/BasedThreadContext";
import { useEffect, useState } from "react";
import { Responsive, WidthProvider } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import { useForm } from "react-hook-form";
import "react-resizable/css/styles.css";
import { z } from "zod";

import type { Dayjs } from "@calcom/dayjs";
import dayjs from "@calcom/dayjs";
import { useFilterQuery } from "@calcom/features/bookings/lib/useFilterQuery";
import { useOrgBranding } from "@calcom/features/ee/organizations/context/provider";
import { getTeamsFiltersFromQuery } from "@calcom/features/filters/lib/getTeamsFiltersFromQuery";
import { BookingKPICards, BookingStatusLineChart } from "@calcom/features/insights/components";
import type { FilterContextType } from "@calcom/features/insights/context/provider";
import { FilterProvider } from "@calcom/features/insights/context/provider";
import { Filters } from "@calcom/features/insights/filters";
import Shell from "@calcom/features/shell/Shell";
import { classNames } from "@calcom/lib";
import { HOSTED_CAL_FEATURES } from "@calcom/lib/constants";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { useRouterQuery } from "@calcom/lib/hooks/useRouterQuery";
import { HttpError } from "@calcom/lib/http-error";
import { md } from "@calcom/lib/markdownIt";
import slugify from "@calcom/lib/slugify";
import turndown from "@calcom/lib/turndownService";
import { MembershipRole, SchedulingType } from "@calcom/prisma/enums";
import { unlockedManagedEventTypeProps } from "@calcom/prisma/zod-utils";
import { createEventTypeInput } from "@calcom/prisma/zod/custom/eventtype";
import { trpc } from "@calcom/trpc/react";
import { Alert, Button, Editor, Form, TextField, showToast, RadioGroup as RadioArea } from "@calcom/ui";

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
  const [instruction, setInstruction] = useState("");

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
                  x: index === 1 ? 12 : 0,
                  y: index === 0 ? 30 : index === 1 ? 30 : index === 2 ? 0 : 0,
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
          <Button onClick={() => generateUI(instruction)}>
            {/* ? "Reschedule all Friday Bookings. Please explain that I catch the flu and I will not be able to make it :,c" */}
            {/* ? "Create a new event type to onboard users into the streamers dashboard of my Twitch extension called Qapla, regularly an onboarding lasts around 45 minutes" */}
            Execute
          </Button>
        }>
        <TextField label="Instruction" value={instruction} onChange={(e) => setInstruction(e.target.value)} />
        <ResponsiveGridLayout
          breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
          cols={
            thread &&
            thread.messages &&
            thread.messages.filter(({ role }) => role === "component").length >= 2
              ? { lg: 24, md: 20, sm: 12, xs: 8, xxs: 4 }
              : { lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }
          }
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

const querySchema = z.object({
  startTime: z.string().nullable(),
  endTime: z.string().nullable(),
  teamId: z.coerce.number().nullable(),
  userId: z.coerce.number().nullable(),
  memberUserId: z.coerce.number().nullable(),
  eventTypeId: z.coerce.number().nullable(),
  filter: z.enum(["event-type", "user"]).nullable(),
});

export function FiltersProvider({
  children,
  startTime,
  endTime,
}: {
  children: React.ReactNode;
  startTime?: string;
  endTime?: string;
}) {
  const utils = trpc.useContext();
  const { data: user } = useMeQuery();

  let startTimeParsed,
    endTimeParsed,
    teamIdParsed: number | undefined | null,
    userIdParsed,
    eventTypeIdParsed,
    filterParsed,
    memberUserIdParsed;

  const safe = querySchema.safeParse({
    startTime,
    endTime,
    teamId: 16,
    userId: user?.id,
    eventTypeId: null,
    filter: null,
    memberUserId: null,
  });

  if (!safe.success) {
    console.error("Failed to parse query params");
  } else {
    startTimeParsed = safe.data.startTime;
    endTimeParsed = safe.data.endTime;
    teamIdParsed = safe.data.teamId;
    userIdParsed = safe.data.userId;
    eventTypeIdParsed = safe.data.eventTypeId;
    filterParsed = safe.data.filter;
    memberUserIdParsed = safe.data.memberUserId;
  }

  const [configFilters, setConfigFilters] = useState<FilterContextType["filter"]>({
    dateRange: [
      startTimeParsed ? dayjs(startTimeParsed) : dayjs().subtract(1, "week"),
      endTimeParsed ? dayjs(endTimeParsed) : dayjs(),
      "w",
    ],
    selectedTimeView: "week",
    selectedUserId: userIdParsed || null,
    selectedMemberUserId: memberUserIdParsed || null,
    selectedTeamId: teamIdParsed || null,
    selectedTeamName: null,
    selectedEventTypeId: eventTypeIdParsed || null,
    selectedFilter: filterParsed ? [filterParsed] : null,
    isAll: false,
    initialConfig: {
      userId: null,
      teamId: null,
      isAll: null,
    },
  });

  const {
    dateRange,
    selectedTimeView,
    selectedMemberUserId,
    selectedTeamId,
    selectedUserId,
    selectedEventTypeId,
    selectedFilter,
    selectedTeamName,
    isAll,
    initialConfig,
  } = configFilters;
  return (
    <FilterProvider
      value={{
        filter: {
          dateRange,
          selectedTimeView,
          selectedMemberUserId,
          selectedTeamId,
          selectedUserId,
          selectedTeamName,
          selectedEventTypeId,
          selectedFilter,
          isAll,
          initialConfig,
        },
        setConfigFilters: (newConfigFilters) => {
          setConfigFilters({
            ...configFilters,
            ...newConfigFilters,
          });
          utils.viewer.insights.rawData.invalidate();
          const {
            selectedMemberUserId,
            selectedTeamId,
            selectedUserId,
            selectedEventTypeId,
            selectedFilter,
            isAll,
            dateRange,
            initialConfig,
          } = {
            ...configFilters,
            ...newConfigFilters,
          };
          const [startTime, endTime] = dateRange || [null, null];
          const newSearchParams = new URLSearchParams(undefined);
          function setParamsIfDefined(key: string, value: string | number | boolean | null | undefined) {
            if (value !== undefined && value !== null) newSearchParams.set(key, value.toString());
          }

          setParamsIfDefined("memberUserId", selectedMemberUserId);
          setParamsIfDefined("teamId", selectedTeamId || initialConfig?.teamId);
          setParamsIfDefined("userId", selectedUserId || initialConfig?.userId);
          setParamsIfDefined("eventTypeId", selectedEventTypeId);
          setParamsIfDefined("isAll", isAll || initialConfig?.isAll);
          setParamsIfDefined("startTime", startTime?.toISOString());
          setParamsIfDefined("endTime", endTime?.toISOString());
          setParamsIfDefined("filter", selectedFilter?.[0]);
        },
        clearFilters: () => {
          const { initialConfig } = configFilters;

          const teamId = initialConfig?.teamId ? initialConfig.teamId : undefined;
          const userId = initialConfig?.userId ? initialConfig.userId : undefined;
          setConfigFilters({
            selectedEventTypeId: null,
            selectedFilter: null,
            selectedMemberUserId: null,
            selectedTeamId: teamId,
            selectedTeamName: null,
            selectedTimeView: "week",
            selectedUserId: userId,
            isAll: !!initialConfig?.isAll,
            dateRange: [dayjs().subtract(1, "week"), dayjs(), "w"],
            initialConfig,
          });

          const newSearchParams = new URLSearchParams();
          if (teamId) newSearchParams.set("teamId", teamId.toString());
          if (userId) newSearchParams.set("userId", userId.toString());
        },
      }}>
      {children}
    </FilterProvider>
  );
}

const InsightsBasedElement = ({ startDate, endDate }: { startDate: string; endDate: string }) => {
  const { t } = useLocale();

  const user = useMeQuery().data;

  if (!user) {
    return <></>;
  }

  return (
    <FiltersProvider startTime={startDate} endTime={endDate}>
      <Filters />

      <div className="mb-4 space-y-4">
        <BookingKPICards />

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

const LockAvailability = ({ day, booking: { eventType } }) => {
  const { t } = useLocale();
  const me = useMeQuery();
  const utils = trpc.useUtils();

  const { data } = trpc.viewer.eventTypes.get.useQuery({
    id: eventType.id,
  });

  const scheduleId = data?.eventType.schedule as number | undefined;
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
    <AvailabilityForm
      updateMutation={updateMutation}
      form={form}
      scheduleId={scheduleId}
      me={me}
      schedule={schedule}
    />
  );
};

const RescheduleComponent = ({ day, reason }: { day: Dayjs; reason: string }) => {
  const { data: filterQuery } = useFilterQuery();
  const utils = trpc.useUtils();
  const [bookings, setBookings] = useState([]);

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

      const bookings = [];
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
                bookings.push(booking);
                rescheduleApi({
                  bookingId: booking.uid,
                  rescheduleReason: reason || "",
                });
              }
            }
          );
        }

        if (bookings.length) {
          setBookings(bookings);
        }
      }
    }
  }, [day, query.data, rescheduleApi, isReschedulePending, reason]);

  return (
    <div className="flex gap-4">
      {bookings.length
        ? bookings.map((booking) => <LockAvailability key={`${booking.uid}`} day={day} booking={booking} />)
        : null}
    </div>
  );
};

const CreateEventType = ({
  title,
  description,
  duration,
}: {
  title?: string;
  description?: string;
  duration?: number;
}) => {
  const routerQuery = useRouterQuery();
  const filters = getTeamsFiltersFromQuery(routerQuery);
  const { data } = trpc.viewer.eventTypes.getByViewer.useQuery(filters && { filters }, {
    refetchOnWindowFocus: false,
    gcTime: 1 * 60 * 60 * 1000,
    staleTime: 1 * 60 * 60 * 1000,
  });

  const { data: user } = useMeQuery();

  const utils = trpc.useContext();
  const { t } = useLocale();
  const [firstRender, setFirstRender] = useState(true);
  const orgBranding = useOrgBranding();

  const teamId = null;
  const pageSlug = user?.username;

  const isOrganization = !!user?.organizationId;

  let profileOptions = null;
  let teamProfile = null;

  if (data) {
    profileOptions = data.profiles
      .filter((profile) => !profile.readOnly)
      .map((profile) => {
        return {
          teamId: profile.teamId,
          label: profile.name || profile.slug,
          image: profile.image,
          membershipRole: profile.membershipRole,
          slug: profile.slug,
        };
      });

    teamProfile = profileOptions.find((profile) => profile.teamId === teamId);
  }

  const isSelfHosted = !HOSTED_CAL_FEATURES;
  const isEE = !!(isSelfHosted || isOrganization);
  const form = useForm<z.infer<typeof createEventTypeInput>>({
    defaultValues: {
      length: 15,
    },
    resolver: zodResolver(createEventTypeInput),
  });

  const schedulingTypeWatch = form.watch("schedulingType");
  const isManagedEventType = schedulingTypeWatch === SchedulingType.MANAGED;

  useEffect(() => {
    if (isManagedEventType) {
      form.setValue("metadata.managedEventConfig.unlockedFields", unlockedManagedEventTypeProps);
    } else {
      form.setValue("metadata", null);
    }
  }, [schedulingTypeWatch]);

  useEffect(() => {
    if (title) {
      form.setValue("title", title);
      if (form.formState.touchedFields["slug"] === undefined) {
        form.setValue("slug", slugify(title));
      }
    }

    if (description) {
      form.setValue("description", turndown(description));
    }

    if (duration) {
      form.setValue("length", duration);
    }
  }, [title, description, form, duration]);

  const { register } = form;

  const isAdmin =
    teamId !== undefined &&
    (teamProfile?.membershipRole === MembershipRole.OWNER ||
      teamProfile?.membershipRole === MembershipRole.ADMIN);

  const urlPrefix = orgBranding?.fullDomain ?? process.env.NEXT_PUBLIC_WEBSITE_URL;

  const createMutation = trpc.viewer.eventTypes.create.useMutation({
    onSuccess: async ({ eventType }) => {
      await utils.viewer.eventTypes.getByViewer.invalidate();
      navigator.clipboard.writeText(
        `${urlPrefix}/${!isManagedEventType ? pageSlug : t("username_placeholder")}/${form.getValues("slug")}`
      );
      showToast(
        t("event_type_created_successfully", {
          eventTypeTitle: eventType.title,
        }),
        "success"
      );
      showToast("Link copied to clipboard!", "success");
      form.reset();
    },
    onError: (err) => {
      if (err instanceof HttpError) {
        const message = `${err.statusCode}: ${err.message}`;
        showToast(message, "error");
      }

      if (err.data?.code === "BAD_REQUEST") {
        const message = `${err.data.code}: ${t("error_event_type_url_duplicate")}`;
        showToast(message, "error");
      }

      if (err.data?.code === "UNAUTHORIZED") {
        const message = `${err.data.code}: ${t("error_event_type_unauthorized_create")}`;
        showToast(message, "error");
      }
    },
  });

  if (!data) return null;

  return (
    <Form
      form={form}
      handleSubmit={(values) => {
        createMutation.mutate(values);
      }}>
      <div className="mt-3 space-y-6 pb-11">
        {teamId && (
          <TextField
            type="hidden"
            labelProps={{ style: { display: "none" } }}
            {...register("teamId", { valueAsNumber: true })}
            value={teamId}
          />
        )}
        <TextField
          label={t("title")}
          placeholder={t("quick_chat")}
          data-testid="event-type-quick-chat"
          {...register("title")}
          onChange={(e) => {
            form.setValue("title", e?.target.value);
            if (form.formState.touchedFields["slug"] === undefined) {
              form.setValue("slug", slugify(e?.target.value));
            }
          }}
        />

        {urlPrefix && urlPrefix.length >= 21 ? (
          <div>
            <TextField
              label={`${t("url")}: ${urlPrefix}`}
              required
              addOnLeading={<>/{!isManagedEventType ? pageSlug : t("username_placeholder")}/</>}
              {...register("slug")}
              onChange={(e) => {
                form.setValue("slug", slugify(e?.target.value), { shouldTouch: true });
              }}
            />

            {isManagedEventType && (
              <p className="mt-2 text-sm text-gray-600">{t("managed_event_url_clarification")}</p>
            )}
          </div>
        ) : (
          <div>
            <TextField
              label={t("url")}
              required
              addOnLeading={
                <>
                  {urlPrefix}/{!isManagedEventType ? pageSlug : t("username_placeholder")}/
                </>
              }
              {...register("slug")}
            />
            {isManagedEventType && (
              <p className="mt-2 text-sm text-gray-600">{t("managed_event_url_clarification")}</p>
            )}
          </div>
        )}
        {!teamId && (
          <>
            <Editor
              getText={() => md.render(form.getValues("description") || "")}
              setText={(value: string) => form.setValue("description", turndown(value))}
              excludedToolbarItems={["blockType", "link"]}
              placeholder={t("quick_video_meeting")}
              firstRender={firstRender}
              setFirstRender={setFirstRender}
            />

            <div className="relative">
              <TextField
                type="number"
                required
                min="10"
                placeholder="15"
                label={t("duration")}
                className="pr-4"
                {...register("length", { valueAsNumber: true })}
                addOnSuffix={t("minutes")}
              />
            </div>
          </>
        )}

        {teamId && (
          <div className="mb-4">
            <label htmlFor="schedulingType" className="text-default block text-sm font-bold">
              {t("assignment")}
            </label>
            {form.formState.errors.schedulingType && (
              <Alert
                className="mt-1"
                severity="error"
                message={form.formState.errors.schedulingType.message}
              />
            )}
            <RadioArea.Group
              onValueChange={(val: SchedulingType) => {
                form.setValue("schedulingType", val);
              }}
              className={classNames("mt-1 flex gap-4", isAdmin && "flex-col")}>
              <RadioArea.Item
                {...register("schedulingType")}
                value={SchedulingType.COLLECTIVE}
                className={classNames("w-full text-sm", !isAdmin && "w-1/2")}
                classNames={{ container: classNames(isAdmin && "w-full") }}>
                <strong className="mb-1 block">{t("collective")}</strong>
                <p>{t("collective_description")}</p>
              </RadioArea.Item>
              <RadioArea.Item
                {...register("schedulingType")}
                value={SchedulingType.ROUND_ROBIN}
                className={classNames("text-sm", !isAdmin && "w-1/2")}
                classNames={{ container: classNames(isAdmin && "w-full") }}>
                <strong className="mb-1 block">{t("round_robin")}</strong>
                <p>{t("round_robin_description")}</p>
              </RadioArea.Item>
              <>
                {isAdmin && isEE && (
                  <RadioArea.Item
                    {...register("schedulingType")}
                    value={SchedulingType.MANAGED}
                    className={classNames("text-sm", !isAdmin && "w-1/2")}
                    classNames={{ container: classNames(isAdmin && "w-full") }}
                    data-testid="managed-event-type">
                    <strong className="mb-1 block">{t("managed_event")}</strong>
                    <p>{t("managed_event_description")}</p>
                  </RadioArea.Item>
                )}
              </>
            </RadioArea.Group>
          </div>
        )}
      </div>
      <hr className="border-subtle" />
      <div className="flex justify-end space-x-2 pb-8 pt-4 rtl:space-x-reverse">
        <Button type="submit" loading={createMutation.isPending}>
          {t("continue")}
        </Button>
      </div>
    </Form>
  );
};

const availableComponents: ExposedComponent[] = [
  {
    name: "Bookings list",
    description: "Display the list of upcoming booked events of the user",
    element: BookingsList,
    extraData: {
      height: 8,
      width: { lg: 24, md: 20, sm: 12, xs: 8, xxs: 4 },
    },
  },
  {
    name: "Insights",
    description: `View booking insights across user events. For your reference, today date is ${dayjs().format(
      "dddd"
    )} ${dayjs().toISOString().split("T")[0]} (UTC time).`,
    element: InsightsBasedElement,
    props: {
      startDate: {
        type: "string",
        description: "Start date to load insights",
        required: true,
      },
      endDate: {
        type: "string",
        description: "End date to load insights",
        required: true,
      },
    },
    loader: ({ startDate, endDate }) => {
      return {
        startDate,
        endDate,
      };
    },
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
  {
    name: "Create event type",
    description: "Shows an, optionally, pre-filled form that allows the user to create a new event type",
    element: CreateEventType,
    props: {
      title: {
        type: "string",
        description: "Title for the new event type",
      },
      description: {
        type: "string",
        description: "Description for the new event type",
      },
      duration: {
        type: "number",
        description: "Duration (in minutes) for the event type",
      },
    },
    loader: ({ title, description, duration }) => {
      return {
        title,
        description,
        duration,
      };
    },
    extraData: {
      height: 13,
      width: { lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 },
    },
  },
];

const availableFunctions: ExposedFunction[] = [];
